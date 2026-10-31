# INTERA O3D 1.2 — Laboratório de um motor V12

Site interativo em português com um motor V12 biturbo procedural, inspirado na imagem de referência. Feito com **Three.js + Vite + JavaScript**, sem backend, conta, API, plugins ou serviços externos para executar a aplicação.

Esta versão **1.2.0 foi reconstruída a partir da 1.1.0** da branch `site-motor-3d`. Os arquivos da antiga versão 1.2 local não estavam disponíveis e não foram recuperados. A branch `main` foi preservada.

**Download:** [ZIP 1.2.0 para VS Code](https://github.com/farenncinathan/intera-o3d/raw/refs/heads/site-motor-3d/downloads/intera-o3d-v1.2.0.zip). O [ZIP com nome fixo](https://github.com/farenncinathan/intera-o3d/raw/refs/heads/site-motor-3d/downloads/intera-o3d.zip) também aponta para esta entrega.

## Rodar no terminal do VS Code

1. Instale o **Node.js 22.12 ou superior** (recomendado: Node.js 24 LTS; inclui o npm).
2. Extraia o ZIP em uma pasta nova e abra no VS Code a pasta que contém `package.json` e `package-lock.json`. O ZIP traz esses arquivos diretamente na raiz, sem outra pasta interna.
3. Abra **Terminal → Novo Terminal** e execute:

```bash
npm ci
npm run dev
```

Se a extração criou duas pastas chamadas `intera-o3d`, entre na pasta interna antes de executar o npm. No PowerShell do Windows, a partir da pasta externa:

```powershell
cd .\intera-o3d
Test-Path .\package.json
npm ci
npm run dev
```

O `Test-Path` deve retornar `True`. Se retornar `False`, confira a pasta aberta no Explorer do VS Code e navegue até aquela que contém o `package.json`.

Abra no navegador o endereço exibido pelo Vite, normalmente `http://localhost:5173`. Para encerrar, pressione `Ctrl+C` no terminal. Se a porta estiver ocupada, o Vite informa outra porta.

Não abra o `index.html` por duplo clique: os módulos precisam do servidor. O comando `npm ci` precisa de acesso à internet para baixar as dependências. Depois da instalação, a aplicação funciona localmente sem serviços online, fontes externas ou credenciais.

### Versão de produção

```bash
npm run build
npm run preview
```

O build está em `dist/`. A prévia normalmente usa `http://localhost:4173`. A configuração `base: './'` permite publicar os arquivos do build em subpastas de uma hospedagem estática; use um servidor HTTP.

### Testes

```bash
npm test
```

Os **22 testes** estão em três arquivos: seis de montagem, seis de cinemática e dez do modelo construído com as mesmas geometrias e matrizes do renderizador. Verificam o curso dos pistões, o comprimento das bielas, o ciclo de 720°, os 90 componentes, as conexões montadas, os mancais reais, as molas com assento fixo e o contato dos comandos com os tuchos sem invasão lateral. A execução não depende de navegador ou WebGL.

### Gerar novamente o ZIP

```bash
npm test
npm run package
```

O segundo comando faz o build e gera `downloads/intera-o3d-v1.2.0.zip` e `downloads/intera-o3d.zip`. O empacotador usa apenas Node.js e funciona também no Windows. Inclui os fontes, o lockfile, os testes, a documentação e `dist/`; exclui `node_modules`, `.git` e os ZIPs anteriores.

## O que explorar

- **90 componentes selecionáveis**, organizados em 13 sistemas: 12 pistões, 12 bielas, 48 válvulas, 4 comandos, 2 cabeçotes, 2 tampas, 2 plenums, 2 turbos, 2 coletores, bloco, virabrequim, distribuição e cárter.
- Clique em qualquer peça do modelo ou use a lista e a busca, que aceita termos com ou sem acento.
- A explicação de cada sistema mostra sua função, como trabalha e suas conexões. O seletor permite percorrer cada peça individualmente.
- Arraste para orbitar; use o scroll para aproximar. No celular, arraste com um dedo e aproxime com dois dedos.
- Dê dois cliques em uma peça ou use **Focar peça**. **Isolar peça** oculta o restante do motor.
- O motor inicia **montado, em 0%**. Controle a **separação das peças**, alterne **transparência** e mostre **etiquetas**. **Restaurar vista** recupera o conjunto montado. A indicação **MONTADO / DESMONTAGEM** identifica o modo atual.
- Reproduza ou pause o motor e ajuste de 600 a 6.000 rpm. A cinemática é exibida **24 vezes mais lenta** para permitir observação.
- Em **Ver o ciclo**, escolha qualquer cilindro e acompanhe admissão, compressão, combustão e escape. Clique em uma etapa ou percorra os 720° manualmente; esse controle pausa a animação. Pressione reproduzir para continuar.
- No celular, alterne entre **Componentes**, **Motor 3D** e **Descobrir**. A animação acompanha a etapa escolhida ao voltar ao modelo.
- O botão **Como explorar** inclui um guia e atalhos: `Espaço` reproduz/pausa, `R` restaura e `Esc` limpa a seleção. `F` foca a peça selecionada.

## Natureza do modelo

Esta é uma **representação didática criada com geometria procedural**, e não a reconstrução exata do motor da imagem. Nenhum modelo CAD ou arquivo 3D do fabricante foi fornecido. Não há vínculo com fabricantes ou uso de suas marcas.

A geometria, os mancais e o percurso da distribuição são simplificados. Os pistões seguem uma equação biela-manivela, os comandos giram à metade da rotação do virabrequim e as válvulas seguem quatro tempos idealizados. Não há avanço de ignição, cruzamento de válvulas, cálculo termodinâmico, pressão de turbo, áudio, lubrificação ou arrefecimento simulados. A sequência de ignição é ilustrativa; não é uma ficha técnica nem um manual de manutenção.

O modo explodido separa as peças para estudo e, por isso, exibe conexões desmontadas. Essas folgas são intencionais apenas na vista explodida. Para observar o movimento das conexões montadas, mantenha a separação em **0%** e ative a transparência, ou abra **Ver o ciclo**.

### Revisão da montagem e do acabamento

Os perfis dos comandos são construídos pelo envelope de apoio de um tucho plano, usando a mesma lei que aciona as válvulas. O raio de base de 0,14 e o curso de 0,04 unidades didáticas mantêm o perfil convexo e o contato durante o ciclo, sem a invasão lateral produzida pelo antigo perfil radial. As molas comprimem enquanto seus assentos permanecem fixos no cabeçote.

Os pontos de referência do pino do pistão, dos olhais da biela e das manivelas do virabrequim compartilham as mesmas coordenadas de montagem. Os eixos dos pistões e das camisas também usam o mesmo espaçamento e o mesmo deslocamento de cada bancada. As faces de encontro do bloco, dos cabeçotes e das tampas, assim como as conexões da admissão, dos coletores de escape, dos turbos e da distribuição, orientam a construção do conjunto montado.

As dimensões externas dos arredondamentos correspondem às medidas usadas na montagem. O cárter vermelho, o alojamento do virabrequim e as saias dos pistões têm aberturas internas. As tampas possuem ombros arredondados, nervuras, juntas e insertos de carbono. Os turbos incluem volutas de seção variável, bocais, atuadores e tubulações com flanges e abraçadeiras.

O acabamento utiliza materiais PBR, com diferenças de rugosidade, reflexão e superfície entre alumínio fundido, aço usinado, pintura vermelha com verniz, borracha e carbono tramado. A iluminação neutra preserva a leitura desses materiais. Esse tratamento mantém a natureza procedural e didática do modelo; ele não transforma a visualização em uma réplica CAD do motor da foto.

## Requisitos e problemas comuns

- Navegador atual com **WebGL 2** (Chrome, Edge, Firefox ou Safari) e aceleração de hardware habilitada. Nenhum plugin é necessário.
- Se o motor não aparecer, atualize o navegador, habilite a aceleração de hardware e recarregue a página. O site mostra uma mensagem quando WebGL não está disponível.
- O aplicativo respeita a preferência do sistema por movimento reduzido e inicia pausado nesse caso.
- `npm: command not found`: instale o Node.js e reabra o terminal do VS Code.
- Erro de versão do Node: confira `node --version` e instale uma versão compatível.
- O ZIP contém o código-fonte, o lockfile, os testes e uma cópia pronta do build (`dist`). Não inclui `node_modules`.

## Estrutura

```text
src/engine.js       Renderização, câmera, seleção, materiais e animação 3D
src/geometry.js     Geometrias compartilhadas pelo modelo e pelos testes
src/model.js        Construção das peças e interfaces de montagem
src/assembly.js     Referências e pontos compartilhados de montagem
src/mechanics.js    Cinemática e ciclo de quatro tempos
src/data.js         Conteúdo didático dos componentes
src/main.js         Interface e controles
src/style.css      Layout responsivo e apresentação
tests/             Testes da cinemática, montagem e geometria real
scripts/package.mjs Empacotamento ZIP com package.json na raiz
public/            Ícone local
```

Os arquivos de teste de navegador usados na validação do ambiente não são necessários para executar o site. Para desenvolvimento, use o checkout existente; cada tarefa de nuvem já é isolada e não precisa de um Git worktree adicional.
