package org.example.javaplaygroundrunner;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class JavaRunnerService {

    public RunResponse run(RunRequest request) throws IOException, InterruptedException {
        RunResponse response = new RunResponse();

        // Seguridad minima: limitar tamanyo del codigo
        if (request.getSource() == null || request.getSource().length() > 10000) {
            response.setStatus("compile-error");
            response.setCompileOutput("Codigo vacio o demasiado grande.");
            return response;
        }

        int timeoutMs = (request.getTimeoutMs() != null) ? request.getTimeoutMs() : 3000;

        // 1. Crear directorio temporal que crea un directorio aleatorio como
        // /tmp/javaplayground-1234567/
        File tempDir = Files.createTempDirectory("javaplayground-").toFile();
        // Permitir que el usuario javaplayground (o el ID que use nsjail) lea y ejecute
        // en esta carpeta
        tempDir.setExecutable(true, false);
        tempDir.setReadable(true, false);
        tempDir.setWritable(true, false);

        try {
            // 2. Escribir Main.java
            File sourceFile = new File(tempDir, "Main.java");
            try (Writer writer = new OutputStreamWriter(new FileOutputStream(sourceFile), StandardCharsets.UTF_8)) {
                writer.write(request.getSource());
            }
            // Cambio de permisos para hacer que el codigo src Main.java pueda ser compilado
            // mediante javac por el usuario que toca -> javaplayground
            sourceFile.setExecutable(true, false);
            sourceFile.setReadable(true, false);
            sourceFile.setWritable(true, false);

            // 3. Compilar: javac Main.java
            ProcessResult compileResult = runProcess(
                    List.of("javac", "Main.java"),
                    tempDir,
                    timeoutMs);

            if (compileResult.timedOut) {
                response.setStatus("timeout");
                response.setCompileOutput("Compilacion excedio el tiempo maximo.");
                response.setTimedOut(true);
                return response;
            }

            if (compileResult.exitCode != 0) {
                response.setStatus("compile-error");
                response.setCompileOutput(compileResult.stdout + compileResult.stderr);
                response.setExitCode(compileResult.exitCode);
                return response;
            }
            // Cambio de permisos para hacer que el codigo src Main.java pueda ser ejecutado
            // mediante java por el usuario que toca -> javaplayground
            File objectFile = new File(tempDir, "Main.class");
            objectFile.setExecutable(true, false);
            objectFile.setReadable(true, false);
            // objectFile.setWritable(true, false); //Aqui no conviene que el codigo una vez
            // generado en bytecode se pueda modificar.

            // 4. Ejecutar: java Main
                    // List<String> cmd = new ArrayList<>();
                    // cmd.add("java");
                    // cmd.add("Main");
            // Seguridad extra proporcionada por nsjail https://github.com/google/nsjail
            List<String> cmd = new ArrayList<>();
            cmd.add("nsjail");
            cmd.add("-q"); // Modo silencioso para solo ver la salida de ejecucion no del nsjail
            cmd.add("-Mo"); // Modo ejecucion unica
//          cmd.add("--chroot"); cmd.add("/"); //Usamos el root del sistema como base

            // AISLAMIENTO DE USUARIO
            cmd.add("--user");
            cmd.add("javaplayground");
            cmd.add("--group");
            cmd.add("javaplayground");

            // AISLAMIENTO DE SISTEMA DE ARCHIVOS
            cmd.add("-R"); cmd.add("/usr");
            cmd.add("-R"); cmd.add("/bin"); // Solo lectura para binarios
            cmd.add("-R"); cmd.add("/lib"); // Solo lectura para librerias
            cmd.add("-R"); cmd.add("/lib64");
            cmd.add("-R"); cmd.add("/etc"); // para encontrar java en Debian

            // EL TRUCO DEL DIRECTORIO TEMPORAL
            // Mapeamos la carpeta de /tmp a una carpeta virtual llamada /app dentro de la jaula
            cmd.add("-B"); cmd.add(tempDir.getAbsolutePath() + ":/app");
            cmd.add("--cwd"); cmd.add("/app"); // Establecemos el directorio de trabajo dentro

            // AISLAMIENTO DE RED Y RECURSOS
//            cmd.add("--net_bin"); // Bloqueo TOTAL de red
            cmd.add("--rlimit_as"); cmd.add("4096"); // 4096MB RAM memoria virtual JVM avariciosa
            cmd.add("--time_limit"); cmd.add("5"); // 5 segundos ejecucion
            cmd.add("--rlimit_fsize");cmd.add("1");
            cmd.add("--rlimit_nproc");cmd.add("50"); // Permitir 50 procesos

            // EL COMANDO FINAL
            cmd.add("--");
            cmd.add("/usr/bin/java");
//          cmd.add("-Xms64m"); //memoria minima de arranque de la JVM
            cmd.add("-Xmx128m");//memoria  maxima para la JMV
            cmd.add("-XX:-UsePerfData");//Elimina directorios de estadisticas que ensucian el directorio de trabajo
            cmd.add("Main");

            ProcessBuilder pb = new ProcessBuilder(cmd);
            // Ya no se necesita pb.directory(tempDir) porque nsjail usa --cwd directorio virtual creada por nsjail /app

            // ProcessBuilder pb = new ProcessBuilder(cmd);
            // pb.directory(tempDir);
            pb.redirectErrorStream(false); // separamos stdout y stderr

            Process proc = pb.start();

            // Escribir stdin si nos lo han pasado. Es una funcionalidad que no esta completamente implementada. Habrá que darle una vuelta
            if (request.getStdin() != null && !request.getStdin().isEmpty()) {
                try (BufferedWriter writer = new BufferedWriter(
                        new OutputStreamWriter(proc.getOutputStream(), StandardCharsets.UTF_8))) {
                    writer.write(request.getStdin());
                    writer.flush();
                }
            } else {
                proc.getOutputStream().close();
            }

            boolean finishedInTime = proc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!finishedInTime) {
                proc.destroyForcibly();
                response.setStatus("timeout");
                response.setTimedOut(true);
                response.setStdout(readStream(proc.getInputStream()));
                response.setStderr(readStream(proc.getErrorStream()));
                return response;
            }

            int exitCode = proc.exitValue();
            String stdout = readStream(proc.getInputStream());
            String stderr = readStream(proc.getErrorStream());

            response.setExitCode(exitCode);
            response.setStdout(stdout);
            response.setStderr(stderr);
            response.setTimedOut(false);

            if (exitCode == 0) {
                response.setStatus("ok");
            } else {
                response.setStatus("runtime-error");
            }

            return response;
        } finally {
            // 5. Borrar el directorio temporal
            deleteRecursively(tempDir);
        }
    }

    private ProcessResult runProcess(List<String> command, File workingDir, int timeoutMs)
            throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workingDir);
        pb.redirectErrorStream(false);

        Process proc = pb.start();

        boolean finished = proc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        ProcessResult result = new ProcessResult();

        result.stdout = readStream(proc.getInputStream());
        result.stderr = readStream(proc.getErrorStream());
        result.timedOut = !finished;
        result.exitCode = finished ? proc.exitValue() : -1;

        if (!finished) {
            proc.destroyForcibly();
        }

        return result;
    }

    private String readStream(InputStream is) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString();
        }
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists())
            return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        file.delete();
    }

    private static class ProcessResult {
        String stdout;
        String stderr;
        int exitCode;
        boolean timedOut;
    }
}