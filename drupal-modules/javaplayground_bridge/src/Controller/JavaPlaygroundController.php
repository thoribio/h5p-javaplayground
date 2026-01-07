<?php

namespace Drupal\javaplayground_bridge\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\javaplayground_bridge\Service\RunnerClient;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class JavaPlaygroundController extends ControllerBase {

  protected RunnerClient $runnerClient;

  public function __construct(RunnerClient $runnerClient) {
    $this->runnerClient = $runnerClient;
  }

  public static function create(ContainerInterface $container): self {
    return new static(
      $container->get('javaplayground_bridge.runner_client')
    );
  }

  /**
   * Endpoint que recibe el codigo desde H5P y lo envia a JavaRunner.
   */
  public function run(Request $request): JsonResponse {
    $content = $request->getContent();
    $payload = json_decode($content, TRUE);

    if ($payload === NULL || !isset($payload['source'])) {
      return new JsonResponse([
        'status' => 'error',
        'message' => 'Payload invalido: falta codigo fuente".',
      ], 400);
    }

    // Seguridad minima: limitar tamaño de codigo.
    if (strlen($payload['source']) > 10000) {
      return new JsonResponse([
        'status' => 'error',
        'message' => 'Codigo demasiado largo.',
      ], 400);
    }
    
    try {
      $result = $this->runnerClient->runCode($payload);

      return new JsonResponse($result, 200);
    }
    catch (\Exception $e) {
      // Log en Drupal para diagnostico.
      $this->getLogger('javaplayground_bridge')->error('JavaRunner error: @msg', ['@msg' => $e->getMessage()]);

      return new JsonResponse([
        'status' => 'internal-error',
        'message' => 'Error llamando a JavaRunner.',
      ], 500);
    }
  }
}