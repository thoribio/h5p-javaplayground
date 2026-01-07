<?php

namespace Drupal\javaplayground_bridge\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use GuzzleHttp\ClientInterface;
use RuntimeException;

class RunnerClient {

  protected ClientInterface $httpClient;
  protected string $runnerBaseUrl;
  protected string $sharedSecret;
  protected bool $verifyTls;
  protected int $timeout;
  protected int $connectTimeout;

  public function __construct(ClientInterface $httpClient, ConfigFactoryInterface $configFactory) {
    $this->httpClient = $httpClient;
    $config = $configFactory->get('javaplayground_bridge.settings');
    $this->runnerBaseUrl = rtrim($config->get('runner_base_url'), '/');
    $this->sharedSecret = (string) $config->get('shared_secret');
    $this->verifyTls = (bool) $config->get('verify_tls');
    $this->timeout = (int) $config->get('timeout_seconds') ?: 5;
    $this->connectTimeout = (int) $config->get('connect_timeout_seconds') ?: 2;
}

  /**
   * Envia el codigo al JavaRunner.
   *
   * @param array $payload
   *   Debe contener al menos 'source', opcional 'stdin', 'timeoutMs'.
   *
   * @return array
   *   Respuesta decodificada JSON del runner.
   *
   * @throws \Exception
   */
  public function runCode(array $payload): array {
    $url = $this->runnerBaseUrl . '/run';

    $options = [
      'json' => $payload,
      'timeout' => $this->timeout,
      'connect_timeout' => $this->connectTimeout,
      'verify' => $this->verifyTls,
      'headers' => [
        'Accept' => 'application/json',
      ],
      // lanzamos excepción por 4xx/5xx; queremos leer body para ver si hay un timeout.
      'http_errors' => false,
    ];
    if($this->sharedSecret !== ''){
      $options['headers']['X-JP-Secret'] = $this->sharedSecret;
    }

    $response = $this->httpClient->request('POST', $url, $options);
    $status = $response->getStatusCode();
    $body = (string) $response->getBody();
    $data = json_decode($body, TRUE);

    // Si el runner no devolvió JSON, devuelve un error estructurado.
    if (!is_array($data)) {
      throw new RuntimeException("Respuesta no-JSON del runner (HTTP $status): " . substr($body, 0, 200));
    }
    // Si el runner devuelve un JSON de error (compile-error, runtime-error, etc.),
    // lo reenviamos tal cual para que el frontend lo muestre correctamente.
    return $data;
  }

}