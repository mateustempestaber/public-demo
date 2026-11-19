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

- **Funcionário:** ver a escala da semana atual e da próxima; pedir uma mudança **urgente** de folga (dias que a lei não deixa aparecem apagados, com o motivo); **trocar** ou **cancelar** o pedido enquanto o gestor não decide.
- **Gestor:** validar ou recusar pedidos; quando a troca deixaria falta de gente ("furo"), conferir a sugestão de quem pode cobrir — **ninguém muda de folga sem o gestor aprovar**.
- **Gestor → Escala → Alterar:** trocar as folgas de alguém (2 dias quaisquer). O sistema deve **recusar** o que quebra o descanso semanal (mais de 6 dias seguidos) ou a folga de domingo.
- **Gestor → Equipe:** cadastrar alguém com um CPF de teste válido (ex.: gere um em um gerador de CPF para testes) e ver se ele entra na escala.

Achou erro? Abra uma **Issue** aqui no repositório dizendo: quem estava logado, o que fez, o que esperava e o que aconteceu (print ajuda).

## Avisos

- Demo de homologação, não é a versão final. Regras de folga de domingo usam a regra mais rígida da CLT enquanto a convenção do sindicato (SINTHORESSARA) não é confirmada.
- Programa compilado não é segredo absoluto: dá para ser analisado por engenharia reversa. Não há senhas nem dados reais aqui.
