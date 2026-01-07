package org.example.javaplaygroundrunner;

public class RunResponse {
    private String status;          // "ok" | "compile-error" | "runtime-error" | "timeout" | "unauthorized"
    private String compileOutput;   // errores de compilacion, si los hay
    private String stdout;          // salida estandar
    private String stderr;          // salida de error
    private Integer exitCode;       // codigo de salida del programa
    private boolean timedOut;       // true si ha habido timeout

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCompileOutput() {
        return compileOutput;
    }

    public void setCompileOutput(String compileOutput) {
        this.compileOutput = compileOutput;
    }

    public String getStdout() {
        return stdout;
    }

    public void setStdout(String stdout) {
        this.stdout = stdout;
    }

    public String getStderr() {
        return stderr;
    }

    public void setStderr(String stderr) {
         this.stderr = stderr;
    }

    public Integer getExitCode() {
        return exitCode;
    }

    public void setExitCode(Integer exitCode) {
        this.exitCode = exitCode;
    }

    public boolean isTimedOut() {
        return timedOut;
    }

    public void setTimedOut(boolean timedOut) {
        this.timedOut = timedOut;
    }
}