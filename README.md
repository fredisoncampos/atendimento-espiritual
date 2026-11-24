# 🕊️ Sistema de Atendimento Espiritual

![Licença: AGPL-3.0](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue)
![Versão](https://img.shields.io/badge/vers%C3%A3o-1.9.4-green)
![Plataformas](https://img.shields.io/badge/plataformas-Windows%20%7C%20Linux-lightgrey)

> Software **livre e gratuito** para casas espíritas e espiritualistas organizarem o **atendimento fraterno** — feito para ser doado a quem não tem condições de pagar por sistemas de mercado.

Funciona **dentro da própria casa, sem internet**: um computador guarda os dados e serve de central, e outros aparelhos no mesmo Wi-Fi (computadores, tablets e celulares) acessam pelo navegador. Sem mensalidade, sem nuvem obrigatória, sem depender de ninguém.

**Baixe a versão pronta** na aba [**Releases**](https://github.com/fredisoncampos/atendimento-espiritual/releases) (instalador do Windows, pacote `.deb` e versão portátil para Linux).

Desenvolvido por **Fredison** (idealização e coordenação) e **Claude**, assistente de IA da Anthropic (programação).

---

Sistema gratuito e de código aberto para casas espíritas e espiritualistas organizarem o **atendimento fraterno**. Com ele a casa faz:

- **A. Cadastros** de pacientes (a idade é calculada sozinha) e de atendentes
- **B. Pesquisa** por nome, telefone, período, atendente e situação
- **C. Novo atendimento** com o questionário dos passos 1 a 10 e a impressão da ficha
- **D. Atendimento**: lançamento da evolução semanal (data, triador e triagem das semanas 1 a 4), copiada da ficha preenchida à mão

Novidades da versão 1.9.4: no item 12 (Encaminhamento) dá para escolher de 1 a 8 sessões por tipo (aparecem na Agenda de retornos e na ficha); no item 6, a visita da Caravana tem as opções "Sim (presencial)", "Sim (online)" e "Não". Da série 1.9: licença AGPL-3.0, administrador padrão na primeira instalação (Admin / 123456, com aviso para trocar), lembrete de retorno por WhatsApp (mensagem configurável), relatório de faltas/frequência, botão "Sobre" com créditos e manual de uso dentro do sistema. Versões anteriores trouxeram: datas em dd/mm/aaaa, tela de Atendimento com semanas recolhíveis, registro de falta e reagendamento, relatório do mês, busca sem acento, aviso de paciente duplicado, ajuda em cada tela, tamanho de letra ajustável, tutorial no primeiro uso, recuperação de senha, cor do tema, agenda de retornos e restauração de backup pela tela.

O sistema funciona **dentro da própria casa**, sem internet. Um computador com Windows guarda os dados e serve de central. Os outros aparelhos ligados ao mesmo Wi-Fi (computadores, tablets e celulares) acessam pelo navegador.

---

## Para a casa espírita: como instalar

1. Baixe o arquivo **`Instalar-Atendimento-Espiritual-1.9.4.exe`** (ou o `.zip` que o contém) no computador que vai ser a central.
2. Clique duas vezes nele e depois em **Avançar** até terminar.
   - O Windows pode mostrar a mensagem *"O Windows protegeu o computador"*, porque o programa é novo e ainda não tem assinatura digital. Clique em **Mais informações** e depois em **Executar assim mesmo**.
   - Deixe marcada a opção **Iniciar junto com o Windows** se outros aparelhos forem usar o sistema.
3. O sistema abre no navegador. Entre com o administrador padrão — **Usuário: `Admin`** e **Senha: `123456`** — e **troque a senha** logo em seguida, em "Alterar minha senha" (um aviso vermelho lembra disso).
4. Em **Configurações**, preencha o nome e os dados da casa (saem na ficha impressa) e ajuste a mensagem de lembrete por WhatsApp, se quiser.
5. Em **Cadastros › Atendentes**, cadastre as pessoas que fazem a recepção. Quem também for entrar no sistema recebe usuário e senha.
6. Em **Configurações › Cópia de segurança**, escolha um pendrive ou uma pasta do Google Drive/OneDrive para os backups automáticos diários.

**Para abrir depois:** use o ícone **Atendimento Espiritual** na área de trabalho. Se o sistema já estiver aberto, o ícone apenas abre o navegador de novo.

**Esqueci a senha do administrador:** no menu Iniciar do computador onde o sistema está instalado, abra a pasta **Atendimento Espiritual** e clique em **Recuperar acesso de administrador**. Ele gera uma senha temporária e a mostra na tela. Entre com ela e troque em "Alterar minha senha". (Se houver outro administrador, ele também pode redefinir a sua senha em Cadastros › Atendentes.)

**Para fechar o programa:** clique em **Sair**, no canto inferior do menu. Ele sai da sua conta e encerra o sistema neste computador. (Se outros aparelhos estiverem usando pela rede, eles perdem o acesso até o sistema ser aberto de novo pelo ícone.)

**Em outros aparelhos:** em **Configurações › Acesso por outros aparelhos** aparece um endereço como `http://192.168.0.10:3210`. Digite esse endereço no navegador do tablet ou do celular (eles precisam estar no mesmo Wi-Fi).

### Testar o uso em vários computadores (passo a passo)

O instalador já deixa o sistema pronto para a rede (escuta em todos os aparelhos e libera o firewall do Windows só para este programa). Para testar com calma na casa:

1. No **computador central**, abra o sistema normalmente pelo ícone e deixe-o aberto.
2. Nesse mesmo computador, vá em **Configurações › Acesso por outros aparelhos** e anote o endereço mostrado (ex.: `http://192.168.0.10:3210`).
3. Pegue um **segundo aparelho** (outro computador, um tablet ou um celular) ligado ao **mesmo Wi-Fi** da casa.
4. Abra o navegador desse aparelho e digite exatamente aquele endereço. O sistema deve aparecer e pedir login.
5. Entre, cadastre um paciente de teste no segundo aparelho e confira, no computador central, que ele aparece na lista. Faça o caminho inverso também.
6. Se **não abrir** no segundo aparelho, verifique: (a) os dois estão no mesmo Wi-Fi? (b) o computador central está ligado e com o sistema aberto? (c) o endereço foi digitado certo, com `http://` e a porta `:3210`? (d) na primeira vez, o Windows do computador central pode perguntar sobre a rede — escolha **Redes privadas**.

Dica: anote o endereço num papel colado no balcão da recepção, para a equipe não precisar procurar toda vez.

---

## Licença

Este software é livre e distribuído sob a **Licença Pública Geral Affero GNU, versão 3 (AGPL-3.0)** — veja o arquivo [`LICENSE`](LICENSE).

Em termos simples: qualquer casa ou pessoa pode **usar, estudar, melhorar e redistribuir** o sistema de graça. Quem distribuir o programa (ou oferecer uma versão modificada pela internet) é **obrigado a manter o código aberto** e disponível, para que as melhorias voltem para a comunidade. Assim o sistema nunca pode ser "fechado" ou privatizado por ninguém.

O código-fonte fica disponível no GitHub: **https://github.com/fredisoncampos/atendimento-espiritual** (e também acompanha cada entrega, no arquivo `atendimento-espiritual-codigo-fonte-*.zip`). Dentro do sistema, o botão **"Sobre o sistema"** (no rodapé do menu) mostra os créditos, a versão, o link do repositório e o manual de uso.

Desenvolvido por **Fredison** (idealização e coordenação) e **Claude**, assistente de IA da Anthropic (programação).

### Onde ficam os dados

Os dados ficam em `C:\ProgramData\AtendimentoEspiritual`, no arquivo `atendimento.db`. Os backups ficam na pasta `backups`. Desinstalar o programa **não apaga** os dados.

**Para restaurar um backup:** vá em **Configurações › Restaurar um backup**, escolha o backup na lista e clique em **Restaurar** (ou informe o caminho de um arquivo de backup de um pendrive). O sistema guarda uma cópia do estado atual, fecha para aplicar e é só abrir de novo pelo ícone.

### Proteção dos dados (LGPD)

A ficha guarda dados de saúde, religião e saúde mental, que a LGPD chama de **dados pessoais sensíveis**. O sistema ajuda com:

- acesso com usuário e senha, e perfis de administrador e de atendente;
- termo de consentimento impresso na ficha, com o registro de que foi assinado;
- registro de quem consultou ou alterou cada ficha (Configurações › Registro de acessos);
- exclusão completa dos dados de um paciente, quando ele pedir;
- backup automático.

Cuidados que ficam por conta da casa:

- proteger o computador central com senha;
- não compartilhar usuários entre pessoas;
- guardar as fichas impressas em local fechado;
- usar o sistema apenas na rede da casa. Ele não foi feito para ser exposto na internet.

---

## Para quem vai manter o código

O código não usa nenhuma biblioteca externa. É só Node.js 22 com o SQLite que já vem embutido nele.

```
app/
  server.js            servidor HTTP, banco SQLite, login, API, backup e auditoria
  public/
    index.html
    styles.css         visual e layout de impressão da ficha (A4)
    questionario.js    PERGUNTAS DOS PASSOS 3 A 10: edite aqui para mudar o questionário
    ficha.js           montagem da ficha impressa
    app.js             telas (menu lateral, cadastros, pesquisa, atendimento, configurações)
instalador/
  instalador.nsi       script do instalador (NSIS)
  iniciar.vbs          abre o sistema sem janela de prompt
  icone.ico
vendor/node.exe        Node.js 22 LTS para Windows, 64 bits (não versionado)
```

**Rodar em desenvolvimento** (Windows, Linux ou Mac, com Node.js 22.13 ou mais novo):

```
cd app
node --no-warnings server.js
# abra http://localhost:3210
```

No Linux e no Mac, os dados ficam na pasta `dados/` do projeto. Para mudar a pasta, defina a variável `ATENDIMENTO_DADOS`. Para mudar a porta, use a variável `PORTA` ou o arquivo `config.json` da pasta de dados.

**Gerar o instalador:**

1. Coloque o `node.exe` (Node.js 22 LTS, win-x64) em `vendor/`.
2. Rode `makensis instalador/instalador.nsi`.
3. O instalador sai na pasta `dist/`.

**Mudar perguntas:** edite apenas `app/public/questionario.js`. O formulário e a ficha impressa se montam sozinhos a partir dele. As respostas são guardadas em JSON, então perguntas novas não exigem mudar o banco de dados.

**Banco de dados:** tabelas `atendentes`, `pacientes`, `atendimentos` (com as respostas em JSON), `evolucoes` (semanas 1 a 4), `config`, `sessoes` e `auditoria`.
