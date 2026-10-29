# INTERA O3D 1.1 — Laboratório de um motor V12

Site interativo em português com um motor V12 biturbo procedural, inspirado na imagem de referência. Feito com **Three.js + Vite + JavaScript**, sem backend, conta, API, plugins ou serviços externos para executar a aplicação.

## Rodar no terminal do VS Code

1. Instale o **Node.js 22.12 ou superior** (recomendado: Node.js 24 LTS; inclui o npm).
2. Extraia o ZIP em uma pasta nova e abra no VS Code a pasta que contém `package.json` e `package-lock.json`. O ZIP da versão 1.1 traz esses arquivos diretamente na raiz, sem outra pasta interna.
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

Os 12 testes verificam o curso do pistão, a conservação do comprimento da biela, o ciclo de 720°, as válvulas, os intervalos entre cilindros e os pontos de montagem compartilhados.

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

Os perfis dos comandos são derivados da mesma função que aciona as válvulas, para acompanhar os tuchos durante o ciclo.

Os pontos de referência do pino do pistão, dos olhais da biela e das manivelas do virabrequim compartilham as mesmas coordenadas de montagem. Os eixos dos pistões e das camisas também usam o mesmo espaçamento e o mesmo deslocamento de cada bancada. As faces de encontro do bloco, dos cabeçotes e das tampas, assim como as conexões da admissão, dos coletores de escape, dos turbos e da distribuição, orientam a construção do conjunto montado.

O acabamento utiliza materiais PBR, com diferenças de rugosidade, reflexão e superfície entre alumínio, aço, pintura e carbono, além de detalhes de flanges e fixações. Esse tratamento melhora a leitura dos materiais e dos encaixes, mantendo a natureza procedural e didática do modelo. Ele não transforma a visualização em uma réplica CAD do motor da foto.

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
src/model.js        Construção das peças e interfaces de montagem
src/assembly.js     Referências e pontos compartilhados de montagem
src/mechanics.js    Cinemática e ciclo de quatro tempos
src/data.js         Conteúdo didático dos componentes
src/main.js         Interface e controles
src/style.css      Layout responsivo e apresentação
tests/             Testes da cinemática
public/            Ícone local
```

Os arquivos de teste de navegador usados na validação do ambiente não são necessários para executar o site. Para desenvolvimento, use o checkout existente; cada tarefa de nuvem já é isolada e não precisa de um Git worktree adicional.
