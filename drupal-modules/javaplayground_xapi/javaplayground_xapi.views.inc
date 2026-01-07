<?php

/**
 * @file
 * Integracion de vistas para la tabla de javaplayground_xapi.
 */

/**
 * Implementa el hook_views_data().
 */
function javaplayground_xapi_views_data() {
  $data = [];

  $data['javaplayground_result']['table'] = [
    'group' => t('JavaPlayground results'),
    'provider' => 'javaplayground_xapi',
    'base' => [
      'field' => 'id',
      'title' => t('JavaPlayground result'),
      'help' => t('Guarda codigo src Java y resultados de un usuario de H5P JavaPlayground.'),
    ],
  ];

  // ID.
  $data['javaplayground_result']['id'] = [
    'title' => t('ID'),
    'help' => t('ID del resultado.'),
    'field' => [
      'id' => 'numeric',
    ],
    'sort' => [
      'id' => 'standard',
    ],
    'filter' => [
      'id' => 'numeric',
    ],
  ];
 // Usuario.
  $data['javaplayground_result']['uid'] = [
    'title' => t('User ID'),
    'help' => t('Usuario que ejecuta el codigo.'),
    'field' => [
      'id' => 'standard',
    ],
    'filter' => [
      'id' => 'user_name',
    ],
    'relationship' => [
      'id' => 'standard',
      'base' => 'users_field_data',
      'base field' => 'uid',
      'relationship field' => 'uid',
      'label' => t('User'),
    ],
  ];

  // Nodo.
  $data['javaplayground_result']['nid'] = [
    'title' => t('Node'),
    'help' => t('Nodo Drupal donde esta el H5P.'),
    'field' => [
      'id' => 'numeric',
    ],
    'relationship' => [
      'id' => 'standard',
      'base' => 'node_field_data',
      'base field' => 'nid',
      'relationship field' => 'nid',
      'label' => t('Node'),
    ],
  ];

  // ContentId H5P.
  $data['javaplayground_result']['content_id'] = [
    'title' => t('H5P content ID'),
    'help' => t('Content ID de H5P.'),
    'field' => ['id' => 'numeric'],
    'filter' => ['id' => 'numeric'],
  ];

  // Codigo.
  $data['javaplayground_result']['code'] = [
    'title' => t('Code'),
    'help' => t('Codigo fuente enviado.'),
    'field' => [
      'id' => 'standard',
    ],
  ];

  // Output.
  $data['javaplayground_result']['output'] = [
    'title' => t('Output'),
    'help' => t('Salida de la consola.'),
    'field' => [
      'id' => 'standard',
    ],
  ];

  // Fecha.
  $data['javaplayground_result']['created'] = [
    'title' => t('Created'),
    'help' => t('Fecha de la ejecucion.'),
    'field' => [
      'id' => 'date',
    ],
    'sort' => [
      'id' => 'date',
    ],
    'filter' => [
      'id' => 'date',
    ],
  ];
return $data;
}