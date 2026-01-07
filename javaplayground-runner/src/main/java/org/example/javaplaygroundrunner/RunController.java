package org.example.javaplaygroundrunner;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/run")
public class RunController {

    private final JavaRunnerService runnerService;

    @Value("${javaplayground.shared-secret:}")
    private String sharedSecret;

    public RunController(JavaRunnerService runnerService) {
        this.runnerService = runnerService;
    }

    @PostMapping
    public ResponseEntity<RunResponse> run(
            @RequestBody RunRequest request,
            @RequestHeader(value = "X-JP-Secret", required = false) String providedSecret
    ) {
        // Si hay secreto configurado, exigirlo.
        if (sharedSecret != null && !sharedSecret.isBlank()) {
            if (providedSecret == null || !sharedSecret.equals(providedSecret)) {
                RunResponse resp = new RunResponse();
                resp.setStatus("unauthorized");
                resp.setStderr("No autorizado");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(resp);
            }
        }
        RunResponse resp = new RunResponse();
        try {
            resp = runnerService.run(request);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            resp.setStatus("internal-error");
            resp.setStderr(e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resp);
        }
    }
}