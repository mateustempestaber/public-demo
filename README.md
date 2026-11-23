# Quintal do Carmo • Escala 5x2 — demo para homologação

Versão de teste do sistema de folgas 5x2. **Este repositório tem só o programa compilado** (sem código-fonte).
Todos os nomes e CPFs são **fictícios**. Não cadastre dados reais de ninguém.

## Opção 1 — direto no navegador (sem instalar nada)

Abra: **https://mateustempestaber.github.io/public-demo/**

Roda inteiro no seu navegador; os dados ficam só no seu computador.
Para começar do zero: `https://mateustempestaber.github.io/public-demo/?reiniciar=1`

## Opção 2 — rodar no seu computador (porta 8787)

1. Baixe o repositório: botão verde **Code → Download ZIP** e extraia.
2. Rode:
   - **Windows:** dois cliques em `iniciar-windows.bat` (se o Windows avisar, clique em *Mais informações → Executar assim mesmo*; se o Firewall perguntar, pode permitir só em rede privada).
   - **Linux / Mac:** no terminal, dentro da pasta: `sh iniciar-linux-mac.sh`
3. Abra **http://localhost:8787**. Deixe a janela do programa aberta enquanto testa.

Os dados ficam no arquivo `dados.json` ao lado. Apague esse arquivo para começar do zero.
Outra pessoa na mesma rede Wi-Fi pode abrir `http://IP-DO-SEU-PC:8787`.

## Opção 3 — sua própria cópia (fork) para mexer à vontade

Quer mudar alguma coisa e testar? Faça a **sua cópia**. Ela é só sua: o que você mudar nela **não altera** este repositório.

1. Entre na sua conta do GitHub e clique em **Fork** (no alto desta página).
2. Na tela que abrir, **desmarque** "Copy the main branch only" e clique em **Create fork**.
3. Na sua cópia, vá em **Settings → Pages**, escolha a branch `homologacao`, a pasta `/ (root)` e clique em **Save**.
4. Em 1–2 minutos sua versão fica em `https://SEU-USUARIO.github.io/public-demo/`.

Na cópia dá para mudar a aparência e os textos (`index.html`, `style.css`, `app.js`). As regras da escala ficam no `app.wasm`, que é compilado.

Quer sugerir algo para a versão oficial? Abra uma **Issue** aqui ou um **Pull Request** da sua cópia — o dono do repositório decide o que entra.

## Opção 4 — servidor na nuvem (porta 8787)

Para deixar o sistema no ar pela internet numa porta própria (`http://IP-DO-SERVIDOR:8787`), num servidor Linux (Ubuntu):

```
curl -fsSL https://raw.githubusercontent.com/mateustempestaber/public-demo/homologacao/servidor/instalar.sh | sudo sh
```

O script baixa o programa, cria um serviço que liga sozinho quando o servidor reinicia e libera a porta 8787 no firewall do servidor. Libere a porta 8787 também nas regras de entrada do painel da nuvem.

## Opção 5 — o dono abre o sistema do próprio PC para os amigos (porta própria, sem cadastro)

No Windows: coloque o `bore.exe` (do projeto aberto [bore](https://github.com/ekzhang/bore/releases)) nesta pasta e dê dois cliques em `abrir-para-amigos.bat`. Ele liga o sistema na porta 8787 e mostra um endereço público como `http://bore.pub:41234`. Funciona enquanto o PC e a janela estiverem abertos.

## Logins de teste

Digite **nome completo + CPF**. O sistema descobre sozinho se você é gestor ou funcionário e abre a tela certa.

| Gestor | CPF |
|---|---|
| Roberto Almeida | 123.456.990-60 |
| Helena Souza | 123.456.991-40 |

| Funcionário | Função | CPF |
|---|---|---|
| Rafael Moura | Garçom | 123.456.001-10 |
| Camila Duarte | Garçom | 123.456.002-09 |
| Thiago Alves | Garçom | 123.456.003-81 |
| Beatriz Lima | Garçom | 123.456.004-62 |
| Lucas Ferraz | Garçom | 123.456.005-43 |
| Juliana Prado | Garçom | 123.456.006-24 |
| Diego Santana | Garçom | 123.456.007-05 |
| Marcos Vidal | Cozinheiro | 123.456.008-96 |
| Patrícia Nogueira | Cozinheiro | 123.456.009-77 |
| Renato Barros | Cozinheiro | 123.456.010-00 |
| Sônia Carvalho | Cozinheiro | 123.456.011-91 |
| Eduardo Pires | Aux. Cozinha | 123.456.012-72 |
| Larissa Teixeira | Aux. Cozinha | 123.456.013-53 |
| Gustavo Rocha | Bartender | 123.456.014-34 |
| Fernanda Azevedo | Bartender | 123.456.015-15 |
| Henrique Dias | Bartender | 123.456.016-04 |
| Maria das Dores | Limpeza | 123.456.017-87 |
| Antônio Silveira | Limpeza | 123.456.018-68 |
| Vanessa Ribeiro | Caixa | 123.456.019-49 |
| Bruno Cardoso | Caixa | 123.456.020-82 |

## O que testar

- **Entrada rápida:** botões "Entrar rápido" na tela de entrada (só contas de exemplo).
- **Escala:** a frase "Hoje" mostra quem trabalha e se falta gente. Toque num dia: **Trabalha**, **Folga neste dia**, **Faltou** (pergunta se trouxe atestado), **Veio trabalhar (extra)**. "Mudar horário" só aparece quando precisa.
- **Mais opções** (embaixo da escala): mostrar horários, resumo do mês, baixar planilha e salvar uma cópia.
- **Equipe:** as pessoas aparecem separadas por equipe. "+ Equipe" cria uma equipe nova (nome, cargo e ícone); "Editar equipe" renomeia ou apaga; ↑ ↓ mudam a ordem. "+ Funcionário" cadastra. Abrindo uma pessoa, "Também é gestor" deixa ela na escala e com acesso às telas de gestor.
- **Mais:** pessoas por dia, feriados, conferir a lei, cópia de segurança e histórico, empresa.
- **O sistema não deixa:** folga que quebra a lei (o dia aparece riscado) nem ficar faltando gente sem você confirmar quem cobre.

Achou erro? Abra uma **Issue** aqui no repositório dizendo: quem estava logado, o que fez, o que esperava e o que aconteceu (print ajuda).

## Avisos

- Demo de homologação, não é a versão final. Regras de folga de domingo usam a regra mais rígida da CLT enquanto a convenção do sindicato (SINTHORESSARA) não é confirmada.
- Programa compilado não é segredo absoluto: dá para ser analisado por engenharia reversa. Não há senhas nem dados reais aqui.
