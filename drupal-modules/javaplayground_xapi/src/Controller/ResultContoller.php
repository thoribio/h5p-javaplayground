<?php

namespace Drupal\javaplayground_xapi\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\Session\AccountProxyInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\Component\Datetime\TimeInterface;

/**
 * Controller para guardar resultados de JavaPlayground.
 */
class ResultController extends ControllerBase
{

  /**
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * @var \Drupal\Core\Database\Connection
   */
  protected $database;
  /**
   * @var \Drupal\Component\Datetime\TimeInterface
   */
  protected $time;

  /**
   * ResultController constructor.
   */
  public function __construct(AccountProxyInterface $current_user, Connection $database, TimeInterface $time)
  {
    $this->currentUser = $current_user;
    $this->database = $database;
    $this->time = $time;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container)
  {
    return new static(
      $container->get('current_user'),
      $container->get('database'),
      $container->get('datetime.time')
    );
  }

  /**
   * Endpoint que recibe el JSON y lo guarda.
   */
  public function store(Request $request)
  {

    $content = $request->getContent();
    $data = json_decode($content, TRUE);

    if (!is_array($data)) {
      return new JsonResponse(['error' => 'Invalid JSON'], 400);
    }

    $code = $data['code'] ?? '';
    $output = $data['output'] ?? '';
    $content_id = isset($data['contentId']) ? (int) $data['contentId'] : NULL;
    $nid = isset($data['nid']) ? (int) $data['nid'] : NULL;

    if ($code === '' && $output === '') {
      return new JsonResponse(['error' => 'Empty payload'], 400);
    }

    $uid = (int) $this->currentUser->id();
    $request_time = $this->time->getRequestTime();

    try {
      // 1. Guardamos el resultado del execute() en una variable
      $id_insertado = $this->database->insert('javaplayground_result')
        ->fields([
          'uid' => $uid,
          'nid' => $nid,
          'content_id' => $content_id,
          'code' => $code,
          'output' => $output,
          'created' => $request_time,
        ])
        ->execute();//el método execute() de una consulta de inserción (insert) devuelve el ID del último registro insertado.
      return new JsonResponse(['status' => 'ok', 'record_id' => $id_insertado]);
    } catch (\Exception $e) {
      return new JsonResponse(['status' => 'Error. No se pudo guardar en la base de datos'], 500);
    }
  }
}