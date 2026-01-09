# H5P.JavaPlayground

Repositorio del proyecto **H5P.JavaPlayground**, un recurso H5P que integra un editor de código Java (CodeMirror) con compilación/ejecución remota mediante un microservicio Java, e integración con Drupal mediante módulos personalizados.

El proyecto se compone de tres piezas principales:

1. **Librería H5P** (`H5P.JavaPlayground`): editor y UI (Run / Send).
2. **Módulos Drupal**:
   - `javaplayground_bridge`: endpoint que reenvía la ejecución al runner.
   - `javaplayground_xapi`: endpoint de persistencia (almacenaje en base de datos Drupal).
3. **Microservicio JavaRunner** (`javaplayground-runner`): compila y ejecuta código Java de forma aislada (nsjail).

## Estructura del repositorio

- `h5p-library/H5P.JavaPlayground/`  
  Código fuente de la librería H5P (library.json, semantics.json, JS, CSS y dependencias de CodeMirror).

- `drupal-modules/`  
  Módulos Drupal personalizados:
  - `javaplayground_bridge/`
  - `javaplayground_xapi/`

- `javaplayground-runner/`  
  Microservicio Spring Boot que expone `POST /run` y ejecuta el código Java (compilación con `javac` y ejecución dentro de `nsjail`).

## Componentes y flujo

1. El usuario interactúa con el editor H5P (CodeMirror).
2. El botón **Ejecutar** llama al endpoint Drupal: `POST /h5p/javaplayground/run`.
3. Drupal (módulo `javaplayground_bridge`) reenvía la solicitud al JavaRunner (`POST /run`) incluyendo un secreto compartido opcional.
4. El JavaRunner compila/ejecuta y devuelve un JSON con `status`, `stdout`, `stderr`, `compileOutput`.
5. El botón **Enviar** guarda el código y resultado en Drupal mediante `POST /h5p/javaplayground/xapi` (módulo `javaplayground_xapi`).

## Requisitos

- Drupal 10 + H5P
- PHP 8.x
- Java 17+ (recomendado)
- Maven
- `nsjail` instalado en el host del runner
- Usuario de sistema dedicado (por ejemplo `javaplayground-api` y/o `javaplayground`)

### Secreto compartido 
El runner valida el header `X-JP-Secret`.

El SHARED_SECRET se almacena en una variable de entorno del servidor.

- `JAVAPLAYGROUND_SHARED_SECRET=CAMBIA_ME`

### Notas de seguridad
El JavaRunner ejecuta el código dentro de `nsjail` con:
- usuario/grupo dedicado
- aislamiento de filesystem (mounts read-only)
- límites de recursos (tiempo, memoria, procesos, tamaño de fichero)

## Licencia

Este proyecto se distribuye bajo la licencia **MIT**.
