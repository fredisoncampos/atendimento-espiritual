# Guia rápido: manter o projeto no GitHub

Um passo a passo simples para deixar o repositório organizado e atualizá-lo quando sair uma versão nova. Não precisa ser especialista.

## 1. O que colocar no repositório

Suba **o código-fonte** (estas pastas e arquivos), e **não** os arquivos pesados gerados:

Suba:
- `app/` (o programa)
- `instalador/` (script do instalador do Windows)
- `README.md`, `LICENSE`, `CHANGELOG.md`, `GUIA-GITHUB.md`, `.gitignore`

Não suba (já estão no `.gitignore`):
- `vendor/` (o `node.exe` e o `node` do Linux — são grandes)
- `dist/` (os instaladores gerados)
- `dados/` (dados de teste)

Os arquivos prontos para baixar (instalador do Windows, `.deb`, portátil) vão na aba **Releases**, não no código (veja o passo 3).

## 2. Enviar/atualizar o código (pelo site, sem terminal)

A forma mais fácil, sem instalar nada:

1. Entre em `github.com/fredisoncampos/atendimento-espiritual`.
2. Clique em **Add file → Upload files**.
3. Arraste as pastas/arquivos da lista "Suba" acima.
4. Em baixo, escreva uma descrição curta (ex.: "versão 1.9.3") e clique em **Commit changes**.

> Dica: para substituir uma pasta inteira, suba os arquivos novos por cima — o GitHub cria uma nova versão de cada arquivo.

Se um dia quiser usar o **GitHub Desktop** (programa com janelas, sem terminal), ele facilita ainda mais: você edita os arquivos na sua pasta e clica em "Commit" e "Push".

## 3. Publicar uma versão para download (Releases)

É aqui que ficam os arquivos prontos para as casas baixarem:

1. No repositório, clique em **Releases** (lado direito) → **Draft a new release**.
2. Em **Tag**, escreva a versão, ex.: `v1.9.3`.
3. Em **Title**, algo como "Atendimento Espiritual 1.9.3".
4. Na descrição, cole as novidades daquela versão (pode copiar do `CHANGELOG.md`).
5. Em **Attach binaries**, arraste os arquivos prontos:
   - `Instalar-Atendimento-Espiritual-v1.9.3.zip` (Windows)
   - `atendimento-espiritual_1.9.3_amd64.deb` (Linux Ubuntu/Mint/Debian)
   - `atendimento-espiritual-linux-portatil-1.9.3.tar.gz` (outras distros Linux)
6. Clique em **Publish release**.

Pronto: o link da aba Releases é o que você divulga para as casas.

## 4. Dica de organização

- Mantenha o `CHANGELOG.md` sempre atualizado — ele conta a história do projeto.
- No README, o aviso sobre o antivírus (Windows sem assinatura) ajuda quem for instalar.
- Se aparecerem colaboradores, o arquivo `LICENSE` (AGPL-3.0) já garante que as melhorias continuem abertas.
