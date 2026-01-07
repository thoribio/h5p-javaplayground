/**
 * JavaPlayground.js
 * JavaPlayground con CodeMirror (sin bundler)
 *
 * Este módulo define el Content Type H5P.JavaPlayground.
 * Se construye como una IIFE (Immediately-Invoked Function Expression) que recibe
 * el $ de H5P.jQuery para no depender de jQuery global.
 */
H5P.JavaPlayground = (function ($) {

  /**
   * decodeHtmlEntities(str)
   * Utilidad defensiva: convierte entidades HTML a texto normal.
   * Esto es útil porque el código por defecto puede venir del editor H5P
   * con entidades escapadas (por ejemplo: &quot; en lugar de ").
   *
   * @param {string} str - Texto posiblemente con entidades HTML.
   * @returns {string} - Texto decodificado.
   */
  function decodeHtmlEntities(str) {
    if (!str) return '';
    var ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value;
  }

  /**
   * Constructor JavaPlayground(params, contentId, contentData)
   * Se ejecuta cuando H5P instancia el Content Type en el iframe.
   *
   * @param {Object} params - Parámetros configurados desde semantics.json (instancia de contenido).
   * @param {number} contentId - ID interno de H5P para esta instancia del contenido.
   * @param {Object} contentData - Metadatos del contenido (en Drupal puede incluir nodeId).
   */
  function JavaPlayground(params, contentId, contentData) {

    // Guardamos contentId para enviarlo al endpoint (auditoría / trazabilidad).
    this.contentId = contentId;

    // Inicializamos EventDispatcher para poder lanzar eventos H5P (p.e. resize, xAPI).
    H5P.EventDispatcher.call(this);

    /**
     * params: configuración del Content Type.
     * $.extend(true, ...) hace un merge profundo:
     * - Defaults (fallbacks defensivos) + params reales (desde semantics.json)
     */
    this.params = $.extend(true, {
      defaultCode: '',               // Código inicial que se carga en el editor.
      theme: 'eclipse',              // Tema de CodeMirror.
      editorHeight: 300,             // Altura por defecto del editor en px.
      showRunButton: true,           // Mostrar botón Ejecutar.
      runButtonLabel: 'Ejecutar código',
      showSendButton: true,          // Mostrar botón Enviar (entrega).
      sendButtonLabel: 'Enviar código y resultado'
    }, params || {});

    // contentData puede traer información adicional (en Drupal, nodeId del nodo que contiene la actividad).
    this.contentData = contentData;

    // Referencia al editor CodeMirror una vez creado.
    this.editor = null;
  }

  // Herencia: JavaPlayground extiende EventDispatcher para integrarse con el ecosistema H5P.
  JavaPlayground.prototype = Object.create(H5P.EventDispatcher.prototype);
  JavaPlayground.prototype.constructor = JavaPlayground;

   /**
   * postResultToDrupal(sourceCode, resultOutput)
   * Persistencia “propia” en Drupal (BBDD) a través del endpoint custom:
   * POST h5p/javaplayground/xapi
   *
   * Flujo:
   * 1) Pedir CSRF token: GET /session/token
   * 2) Enviar payload con token: POST /javaplayground/xapi
   *
   * Nota1: esta función DEVUELVE una Promise.
   * Eso permite encadenar .then() desde el botón de envío.
   * 
   * Nota2: aquí requrimos de CSRF porqué el usuario realizará una operación que modifica el estado de Drupal (Inserta en la BBDD)
   * Mediante CSRF token evitamos que un desde un actor externo se fuerce que un usuario autentificado use el EndPoint sin su consentimiento 
   * aprovechando una sesion abierta.
   *
   * @param {string} sourceCode
   * @param {string} resultOutput
   * @returns {Promise<any>} - Respuesta del endpoint (JSON o texto).
   */
  JavaPlayground.prototype.postResultToDrupal = function (sourceCode, resultOutput) {
    var self = this;

    // Endpoint Drupal que guarda resultados (módulo custom javaplayground_xapi) .
    var apiUrl = '/h5p/javaplayground/xapi';
    // Endpoint estándar Drupal para CSRF token.
    var tokenUrl = '/session/token';

    // 1) Obtener token CSRF
    return fetch(tokenUrl, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('No se pudo obtener el CSRF token');
        return response.text();
      })
      .then(function (token) {

        /**
         * payload: datos guardados en Drupal.
         * - code y output: lo esencial para revisión docente.
         * - contentId: identificador H5P de la instancia.
         * - nid: node Drupal que contiene la actividad (si existe).
         */
        var payload = {
          code: sourceCode,
          output: resultOutput,
          contentId: self.contentId || null,
          nid: (self.contentData && self.contentData.nodeId) ? self.contentData.nodeId : null
        };

        // 2) Enviar a endpoint de Drupal con token CSRF
        return fetch(apiUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify(payload)
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Error HTTP ' + res.status);

        /**
         * Drupal puede responder JSON o texto (según cómo esté implementado el endpoint).
         * Por eso se revisa el content-type antes de parsear.
         */
        var contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .catch(function (err) {
        // Re-lanzamos error para que el caller (botón Enviar) pueda pintar feedback al usuario.
        throw err;
      });
  };

  /**
   * attach($container)
   * Método estándar H5P: se llama cuando el contenido debe renderizarse.
   * Aquí se construye el DOM: editor, botones, salida y estado.
   *
   * @param {H5P.jQuery} $container - Contenedor donde montar el contenido.
   */
  JavaPlayground.prototype.attach = function ($container) {
    var self = this;

    // Limpiamos el contenedor y añadimos una clase base para CSS.
    $container.empty().addClass('h5p-java-playground');

    // Wrapper principal (flex column según tu CSS).
    var $wrap = $('<div/>', { 'class': 'jp-wrapper' });

    // Cargamos el código inicial desde params (semantics.json), decodificando entidades HTML.
    var initialCode = decodeHtmlEntities(self.params.defaultCode || '');

    // Textarea base que CodeMirror transformará en editor visual.
    var $ta = $('<textarea/>', { 'class': 'jp-textarea' }).val(initialCode);

    /**
     * $out: salida del runner (compilación/ejecución).
     * Solo existe si showRunButton = true (modo ejemplo no muestra salida).
     */
    var $out = null;
    if (self.params.showRunButton) {
      $out = $('<pre/>', { 'class': 'jp-output', 'aria-live': 'polite' });
    }

    /**
     * $status: mensajes cortos de estado (guardado OK / error).
     * Solo existe si showSendButton = true.
     */
    var $status = null;
    if (self.params.showSendButton) {
      $status = $('<div/>', { 'class': 'jp-status' });
    }

    /**
     * Botón Ejecutar:
     * - Recoge el código actual del editor
     * - Llama al endpoint /h5p/javaplayground/run (Drupal → Runner)
     * - Escribe salida en $out
     */
    var $runBtn = null;
    if (self.params.showRunButton) {
      $runBtn = $('<button/>', {
        'type': 'button',
        'class': 'jp-run',
        text: self.params.runButtonLabel || 'Ejecutar código'
      }).on('click', function () {

        // Leemos el código: preferimos CodeMirror; si no existe por alguna razón, usamos el textarea.
        var code = self.editor ? self.editor.getValue() : $ta.val();

        // Mensaje inmediato para feedback (UX).
        $out.text('⏳ Enviando al compilador...');
        // H5P necesita recalcular el tamaño del iframe al cambiar contenido.
        self.trigger('resize');

        // Llamada al runner vía endpoint Drupal (ver función global executeCodeRunner).
        executeCodeRunner(code)
          .then(function (data) {
            // Ponemos el color por defecto, por si viene con un color de un error
            $out.css('color','');

            var outputText = '';
            /**
            * Caso 0: Error de Secreto/Autenticación
            * Se captura antes que los errores de compilación para detener el flujo.
            */
            if (data.status === 'unauthorized') {
              $out.css('color', 'red'); // Un color rojo suave para errores de sistema
              outputText += '❌ERROR DE SISTEMA: Fallo de autenticación.\n';
              outputText += 'El secreto compartido entre Drupal y el Runner no coincide.\n';
              outputText += 'Por favor, revisa la configuración del servicio.';
              $out.text(outputText);
              self.trigger('resize');
              return; // Salimos de la función para no procesar el resto
            }
            /**
             * Caso 1: error de compilación (el runner devuelve status = 'compile-error')
             * Se imprime compileOutput (salida del compilador javac).
             */
            if (data.status === 'compile-error') {
              outputText += '❌ Error de compilación:\n';
              outputText += (data.compileOutput || '(Sin detalles)') + '\n';
            }
            /**
             * Caso 2: compilación OK -> ejecución (puede haber stdout y/o stderr).
             * Nota: stderr se considera “error runtime” solo si contiene texto significativo (trim()).
             */
            else {
              outputText += '✅ Ejecución completada\n';
              if (data.stdout) {
                outputText += '\n Salida estándar:\n' + data.stdout;
              }

              /* Runtime error solo si stderr tiene contenido significativo 
              (Detección robusta: stderr puede venir vacío o con saltos de línea.)*/
              if (
                data.stderr &&
                typeof data.stderr === 'string' &&
                data.stderr.trim().length > 0
              ) {
                outputText += '\n❌ Errores en tiempo de ejecución:\n' + data.stderr;
              }
            }
            // Pintamos el texto completo en el <pre>
            $out.text(outputText);
            // Resize del iframe H5P para que se vea la salida completa.
            self.trigger('resize');
          })
          .catch(function (err) {
            // Error de red, endpoint caído, CORS, timeout, etc.
            $out
              .css('color', 'red')
              .text('❌ Error: No se ha podido ejecutar el código.\n' + err.message);

            self.trigger('resize');
          });
      });
    }

    /**
     * Botón Enviar:
     * - Envía persistencia a Drupal (tabla propia)
     * - Muestra estado OK/ERROR en $status
     */
    var $sendBtn = null;
    if (self.params.showSendButton) {
      $sendBtn = $('<button/>', {
        'type': 'button',
        'class': 'h5p-codeeditor-send-button',
        'text': self.params.sendButtonLabel || 'Enviar código y resultado'
      }).on('click', function () {

        // Código fuente actual.
        var code = self.editor ? self.editor.getValue() : $ta.val();

        // Output actual mostrado (si existe). En modo sin run, output será ''.
        var consoleOutput = $out ? $out.text() : '';

        // 1) Feedback visual (estado) mientras guardamos en Drupal
        if ($status) $status.text('Guardando en base de datos...');

        // 2) Persistencia en Drupal
        self.postResultToDrupal(code, consoleOutput)
          .then(function (data) {
            // data puede ser JSON o texto, según el endpoint.
            if ($status) {
              $status.css('color', 'green').text('✅ Código guardado correctamente.');
              // setTimeout opcional si quieres que desaparezca el mensaje.
              // setTimeout(function () { $status.text(''); }, 5000);
            }
          })
          .catch(function (err) {
            if ($status) {
              $status.css('color', 'red').text('❌ Error: ' + err.message);
            }
          });
      });
    }

    /**
     * Montaje final del DOM según configuración:
     * - Siempre se añade el textarea (base del editor)
     * - Los botones / salida / estado dependen de flags de semantics.json
     */
    $wrap.append($ta);
    if ($runBtn) $wrap.append($runBtn);
    if ($out) $wrap.append($out);
    if ($sendBtn) $wrap.append($sendBtn);
    if ($status) $wrap.append($status);

    // Insertamos todo en el contenedor H5P.
    $container.append($wrap);

    /**
     * Inicialización del editor CodeMirror:
     * - Transforma el textarea en un editor con resaltado Java (mode clike)
     * - El tema se selecciona en semantics.json (theme)
     */
    self.editor = CodeMirror.fromTextArea($ta.get(0), {
      mode: 'text/x-java',
      theme: self.params.theme || 'eclipse',
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      lineWrapping: false
    });

    /**
     * Altura configurable del editor:
     * - parseInt para asegurar número
     * - clamp para evitar valores extremos (seguridad/robustez)
     */
    var height = parseInt(self.params.editorHeight, 10);
    if (isNaN(height)) height = 300;
    height = Math.max(150, Math.min(900, height)); // 150<=height<=900

    // Tamaño del editor: 100% ancho y altura en px.
    self.editor.setSize('100%', height);

    // Cada vez que el usuario escribe, se recalcula el alto del iframe H5P.
    self.editor.on('change', function () { self.trigger('resize'); });

    // Forzamos un primer resize al terminar de montar.
    self.trigger('resize');
  };

  // Exponemos el constructor al exterior (H5P lo instancia).
  return JavaPlayground;

})(H5P.jQuery);

/**
 * executeCodeRunner(sourceCode)
 * Servicio de ejecución: envía el código al endpoint Drupal
 * y devuelve el resultado como Promise.
 *
 * NO modifica DOM
 * NO conoce H5P
 *
 * @param {string} sourceCode
 * @returns {Promise<Object>} resultado estructurado
 */
var executeCodeRunner = function (sourceCode) {
 
  // Endpoint Drupal de enlace con el microservicio que compila, ejecuta y devuelve resultado (módulo custom javaplayground_bridge) .
  var runnerUrl = '/h5p/javaplayground/run';
  
  // Llamada POST con JSON (source + stdin + timeout)
  return fetch(runnerUrl, {
    method: 'POST',
    /* Credenciales del logueo del alumno en la plataforma de Drupal. Están implicitas como una cookie ofrecida por drupal al loguearse 
    * el alumno. Es una cookie no accessible por js, solo por el navegador (HttpOnly). 
    */
    credentials: 'same-origin',
    /* Nota: aquí NO requerimos de CSRF porqué el usuario no realizará una operación que modifica el estado de Drupal
    *  (Solo envia codigo al microservicio del JavaRunner), aunque en una futura version se podría añadir para aumentar la seguridad. 
    */
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: sourceCode,
      stdin: '',
      timeoutMs: 2000
    })
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Error HTTP ' + response.status);
      }
      return response.json();
    });
};