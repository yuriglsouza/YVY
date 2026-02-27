# Roteiro de Entrevista com Produtores Rurais: Foco em Necessidades Reais

**Objetivo:** Entender as principais dores do produtor no dia a dia da lavoura e conectar essas necessidades com as soluções que os índices de imagens de satélite (NDVI, NDWI, LST, etc.) podem resolver. O segredo é usar a linguagem de **manejo e negócio** dele, deixando as siglas técnicas de lado.

---

## 1. Quebra-Gelo e Contexto da Propriedade (Abertura)
*O objetivo aqui é deixar o produtor confortável e entender o cenário geral da operação dele.*

* "Como está sendo o planejamento ou o andamento da safra atual por aqui?"
* "Quais são os principais desafios imprevisíveis que a sua fazenda tem enfrentado? (Ex: Clima, pragas, custo de insumos, mão de obra?)"
* "Como você supervisiona hoje toda a extensão da sua propriedade? Com que frequência sua equipe consegue 'rodar' fisicamente todos os talhões?"

---

## 2. Traduzindo a Tecnologia (Índices) em Dores Cotidianas

*Aqui substituímos o "jargão do engenheiro de software/sensoriamento" por perguntas sobre o problema que o índice resolve.*

### A. Saúde e Vigor da Planta (Traduzindo NDVI / EVI)
* **A dor:** Ataque de pragas, doenças ou falhas no plantio que passam despercebidos até gerarem prejuízo.
* **Perguntas para o produtor:**
  * "Você já teve situações em que só percebeu que uma parte da lavoura estava se desenvolvendo mal quando já era tarde demais para tratar?"
  * "Como você acompanha a saúde e o vigor da planta hoje? Seria útil ter uma visão 'de cima' que te mostrasse antecipadamente as manchas onde as plantas estão menos sadias, antes mesmo do olho humano perceber andando de caminhonete?"

### B. Estresse Hídrico e Umidade (Traduzindo NDWI / NDMI)
* **A dor:** Irrigar no escuro, falta de chuva, ou áreas encharcadas que afogam raízes.
* **Perguntas para o produtor:**
  * "Como as secas ou excessos de chuva têm impactado talhões específicos de forma diferente?"
  * "Saber exatamente quais partes da lavoura estão sofrendo com falta ou excesso de umidade na planta faria você mudar alguma decisão de irrigação, aplicação de fertilizante ou até de época de plantio nessas manchas?"

### C. Temperatura da Superfície / Solo (Traduzindo LST - Land Surface Temperature)
* **A dor:** Estresse térmico excessivo cortando a produtividade ou risco de geadas e perdas totais de safra.
* **Perguntas para o produtor:**
  * "Em dias de calor extremo ou risco de geada, como você avalia o dano na lavoura depois?"
  * "Monitorar a temperatura exata da superfície do seu solo e das folhas ajudaria você a escolher um momento melhor para aplicar um defensivo agrícola (para que ele não evapore rápido demais) ou a acionar um sistema de irrigação?"

---

## 3. Entregabilidade e Usabilidade (Como ele quer ver os dados)
*O objetivo aqui é entender como a tecnologia se encaixa na rotina do campo, para que o painel (dashboard) / sistema seja adotado e não ignorado.*

* "Se você recebesse um 'raio-X' ou um alerta mostrando exatamente os 3 pontos mais complexos da sua fazenda naquela semana, o que você ou seu agrônomo fariam em seguida com essa informação?"
* "Em meio a tantas coisas para fazer, como você prefere ser avisado de um problema? Pelo WhatsApp rápido no meio do dia, ou prefere sentar com calma e abrir um painel no computador de manhã?"
* "Para você, é melhor ver um gráfico com o histórico do mês, ou é melhor ver um mapa colorido da fazenda com uma marcação dizendo: 'Vá checar essa área aqui'?"

---

## 4. Encerramento e Validação Aberta
* "Na sua opinião pessoal, qual é a ferramenta ou a informação que hoje, se você tivesse na palma da mão, faria a sua fazenda render mais ou gastar bem menos?"
* "Tem alguma dor de cabeça diária no campo que nós não comentamos, mas que você adoraria que a tecnologia resolvesse?"

---

> **Dica para a Equipe de Produto/Desenvolvimento:**
> As respostas para as perguntas da **Seção 2** validarão QUAIS índices devem ser priorizados no backend e no modelo. As respostas da **Seção 3** ditarão COMO o frontend (UX/UI) e as notificações devem ser construídas.
