# Alterações

## 1.2.0

Versão reconstruída a partir da 1.1.0 em `site-motor-3d`. A antiga 1.2 local não foi recuperada; esta entrega refaz as melhorias sobre a base disponível. A `main` permanece preservada.

- Tampas vermelhas com cascas contínuas, nervuras, juntas, fixações e detalhes de carbono; cárter vermelho e pistões com interiores ocos.
- Turbos com volutas de seção variável, bocais de entrada, atuadores de wastegate, flanges e abraçadeiras; tubulações ligadas às âncoras das duas bancadas.
- Pintura com verniz, alumínio fundido, metais usinados, borracha e carbono tramado diferenciados, com iluminação e reflexos ajustados.
- Geometrias compartilhadas por renderização e testes; arredondamentos respeitam as dimensões externas usadas nos encaixes.
- Molas das válvulas comprimem com assento fixo no cabeçote e prato acompanhando a haste.
- Comandos construídos pelo envelope de um tucho plano, com raio de base 0,14 e curso de válvula 0,04 unidades, evitando invasão lateral durante a animação.
- Preservados os 90 componentes selecionáveis, explicações, animação, transparência, foco, isolamento e vista explodida.
- 22 testes automatizados: seis de montagem, seis de cinemática e dez da geometria real, incluindo mancais e contatos durante os 720° do ciclo.
- Empacotamento portátil via `npm run package`, com `package.json` e lockfile na raiz, fontes e build de produção; sem `node_modules` ou ZIPs recursivos.

## 1.1.0

- Montagem baseada em pontos de conexão compartilhados, incluindo eixos e espaçamentos de pistões, camisas, pinos, bielas e manivelas.
- Tampas ocas, juntas, mancais com furos, flanges e tubulações contínuas entre cabeçotes, plenums e turbos.
- Distribuição alinhada aos quatro comandos, com corrente seguindo as engrenagens.
- Perfis dos comandos derivados da abertura das válvulas.
- Materiais de pintura com verniz, carbono tramado, alumínio fundido, aço usinado e carcaças quentes distintas.
- Correção da atualização de shaders no modo transparente.
- Inicialização e restauração montadas em 0%; indicador MONTADO/DESMONTAGEM.
- Enquadramento ajustado para celular e ZIP com arquivos na raiz para facilitar a extração.
- 12 testes automatizados de cinemática e montagem.

A visualização continua didática, com geometria e sequência de ignição ilustrativas. Não é uma réplica CAD nem um simulador termodinâmico.
