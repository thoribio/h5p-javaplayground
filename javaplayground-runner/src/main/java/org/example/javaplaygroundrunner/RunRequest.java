package org.example.javaplaygroundrunner;

public class RunRequest {
    // Codigo fuente completo con una clase Main publica
    private String source;

    // Entrada estandar opcional
    private String stdin;

    // Timeout maximo en milisegundos (opcional)
    private Integer timeoutMs;

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getStdin() {
        return stdin;
    }

    public void setStdin(String stdin) {
        this.stdin = stdin;
    }

    public Integer getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(Integer timeoutMs) {
        this.timeoutMs = timeoutMs;
    }
}