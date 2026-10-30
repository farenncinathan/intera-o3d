# Intera

Uma experiência interativa para explorar a engenharia por dentro. O motor V8 biturbo foi criado com geometria procedural em Three.js, inspirado na referência de um motor em vista explodida.

## Desenvolvimento

Requer Node.js 20.19+ ou 22.12+.

```sh
npm ci
npm run dev
```

O servidor Vite atende na porta 5173. Para compilar e conferir a versão de produção:

```sh
npm run build
npm run preview
```

## Experiência

- Modelo 3D real: arraste para girar; use o scroll, pinça ou os botões de zoom para aproximar.
- Controle contínuo de montagem/desmontagem, de 0 a 100%.
- Sete conjuntos selecionáveis pelo modelo ou pela lista de componentes.
- Informações sobre a função e os materiais de cada conjunto.
- Rotação automática, restauração de câmera e tela cheia.
- Biblioteca com busca, guia de uso e apresentação do projeto.
- Interface em português, adaptada para celular e teclado.

A representação é didática; proporções e especificações são ilustrativas. O visualizador requer um navegador com WebGL. Geometria, ícones e fontes são servidos pelo próprio projeto, sem downloads de modelos ou fontes em tempo de execução.

## Organização

- `src/main.jsx`: interface, conteúdo, biblioteca e diálogos.
- `src/Viewer.jsx`: cena WebGL, iluminação, câmera e seleção por raycasting.
- `src/engine.js`: geometria, materiais, componentes e montagem do motor.
- `src/style.css`: identidade visual e layouts responsivos.
