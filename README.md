# MUV Royalties — Design Lab V1

Protótipo **local e isolado** para experimentar a interface do MUV Royalties Ops. Este diretório não é o projeto oficial. Todos os nomes, fontes, valores, extratos e lançamentos usados nas telas são fictícios.

## Abrir em outro computador

Repositório deste Design Lab: [guivital1/esbo-o](https://github.com/guivital1/esbo-o). Clone o repositório para abrir o protótipo em outro computador.

Instale o Node.js compatível com o Vite deste projeto (**série 20 a partir da 20.19, ou 22.12+**) e o npm:

```bash
git clone https://github.com/guivital1/esbo-o.git
cd esbo-o
git switch --track origin/feat/next-five-ux
cd royalties_ops/web
npm ci
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente `http://localhost:5173/`. No Windows, os mesmos comandos funcionam no PowerShell. Para conferir a compilação, execute `npm run build` dentro de `royalties_ops/web`. A branch `main` é um checkpoint anterior; a interface atual está em `feat/next-five-ux`.

> **Atenção:** este comando abre o Design Lab para comparação visual. No computador da empresa, o projeto oficial que já consulta a API deve continuar em seu próprio repositório. Não substitua o projeto oficial por este protótipo.

## Aplicar o layout ao projeto oficial da empresa

Abra **os dois projetos lado a lado** no computador da empresa: este Design Lab na branch `feat/next-five-ux` e o projeto oficial em sua branch de trabalho. Use o Design Lab como referência executável de tela e interação. Preserve no projeto oficial as chamadas à API, autenticação, tratamento de erros, regras financeiras e permissões existentes.

Roteiro para o Codex no projeto oficial:

1. Inspecione as rotas, componentes, tipos e contratos de API reais do projeto oficial. Identifique como ele representa empresa, competência, extrato, fonte pagadora, recebimento, lançamento, importação e usuário autenticado. Não presuma que os nomes ou formatos coincidam com `src/types.ts` deste laboratório.
2. Compare cada tela oficial com o componente correspondente no mapa abaixo e migre **estrutura, CSS e comportamento de interação** de forma incremental. Comece pela estrutura comum (sidebar, cabeçalho e perfil), depois Visão geral, Operação, Importar dados, Fontes pagadoras e Histórico de extratos. Valide uma tela antes de seguir para a próxima.
3. Substitua os dados fictícios por propriedades vindas dos adaptadores já existentes no projeto oficial. Use os totais e estados fornecidos pela API quando ela for a fonte oficial; mantenha as regras de cálculo já existentes. Não copie números, IDs, nomes, datas ou classificações de `src/mockData.ts`.
4. Use `src/api.ts` **somente para entender o fluxo da demonstração**. Não copie seu armazenamento em memória nem troque clientes HTTP reais por ele. A mesma regra vale para o login fictício, a saída de sessão simulada, as visões salvas e a trilha de auditoria: conecte essas funções apenas a mecanismos reais aprovados no projeto oficial.
5. Antes de concluir, teste navegação, estados vazios, erros da API, carregamento, permissões, foco do teclado e valores financeiros no ambiente de desenvolvimento da empresa. Confira a aparência em desktop com zoom de 100% e largura semelhante à usada na revisão visual.

**Fidelidade visual:** o código, CSS, logo e demais arquivos necessários para abrir o Design Lab estão versionados. O resultado pode variar levemente entre macOS e Windows porque a interface usa fontes do sistema (`-apple-system`/San Francisco no Mac e `Segoe UI` no Windows); não há arquivo de fonte proprietário incluído.

Mensagem sugerida ao Codex **dentro do projeto oficial**:

> Tenho o projeto oficial e o Design Lab `guivital1/esbo-o`, branch `feat/next-five-ux`, disponíveis neste computador. Inspecione primeiro as APIs, tipos, autenticação e regras de negócio do projeto oficial. Use o Design Lab como referência visual e de interação para portar as telas gradualmente. Preserve os dados e integrações reais; não copie `src/api.ts` nem `src/mockData.ts` do laboratório. Mostre o mapeamento entre componentes e dados antes de editar, valide cada tela em desktop e execute os testes do projeto oficial. Não publique nem altere produção sem meu pedido.

## O que existe hoje

- **Histórico de extratos bancários:** navegação entre extratos e versões, importação demonstrativa e consulta dos recebimentos.
- **Fontes pagadoras:** cadastro e identificação bancária em formato de protótipo.
- **Conciliação › Visão geral:** resumo financeiro, fontes com movimento e painel contextual da fonte. A seção **Conferência para fechamento** separa diferenças a conciliar, catálogos acima do recebido e recebimentos sem fonte, com acesso à ação correspondente. **Prévia de fechamento** mostra os totais e bloqueios, sem concluir financeiramente a competência. A **Linha do tempo** reúne registro do extrato, início da conciliação, lotes, observações e lançamentos manuais demonstrativos.
- **Conciliação › Operação:** conferência por fonte e lançamentos demonstrativos. A **Fila de divergências** agrupa catálogo acima do recebido, valores ainda não conciliados e recebimentos sem fonte; cada item abre a conferência correspondente, com até três itens visíveis por grupo antes de expandir. A última fonte selecionada, a busca e o filtro da fila reaparecem ao sair da Operação e voltar durante a sessão; trocar empresa, competência ou extrato limpa essa seleção. As visões rápidas incluem **Minhas pendências** (atribuição fictícia a Guilherme Vital) e **Sem fonte**. É possível salvar, aplicar e remover uma combinação nomeada de filtro e busca; essas visões existem apenas na memória da aba. Na lista, Tab entra na linha ativa, ↑/↓ percorrem as linhas visíveis, Home/End vão à primeira/última linha e Enter abre a fonte ou recebimento. Esc fecha o painel de fonte e devolve o foco à linha. Ao abrir um recebimento sem fonte no extrato, aparece **Voltar à Operação**; o retorno restaura empresa, competência, extrato, busca e filtro. Após confirmar uma associação a uma única fonte, o retorno abre essa fonte no painel da Operação. O detalhe apresenta recebimentos do extrato e lançamentos do catálogo lado a lado, além de **Próxima fonte**. Um lançamento manual parcialmente preenchido pede confirmação antes de ser descartado. A **Trilha de auditoria** recolhível reúne exemplos fictícios e ações/observações da sessão, com ator, data e valores antes/depois quando um lançamento manual altera os saldos.
- **Contexto da Conciliação:** empresa, competência e versão do extrato selecionadas permanecem ao navegar para outras páginas do aplicativo e voltar à Visão geral, Operação ou Importar dados. Essa seleção vale apenas enquanto a página estiver aberta; uma recarga restaura os valores iniciais. O Histórico de extratos bancários mantém filtros próprios.
- **Orientação nas telas:** Operação e Nova importação mostram empresa e competência no topo. O Histórico de importações mostra a empresa; o mês eventualmente selecionado aparece no filtro próprio dessa lista.
- **Proteção da prévia:** na Nova importação, se a prévia fictícia do CSV estiver aberta, trocar empresa, competência ou extrato/versão exige escolher entre continuar conferindo ou descartar a prévia e mudar o contexto. Nenhum dado é gravado nessa etapa; a confirmação da importação continua separada.
- **Conciliação › Importar dados:** fluxo de seleção, prévia e confirmação fictícia de CSV; Histórico agrupado por **empresa e competência**, com filtro compacto de competência e busca pelo nome do arquivo. Cada mês se expande para mostrar data, arquivo, envio, valor e quantidade de **fontes pagadoras únicas** nos lotes daquele mês; o total e a quantidade de fontes do mês permanecem integrais mesmo ao filtrar arquivos. Estados vazios oferecem **Nova importação** quando não há lotes e **Limpar filtros** quando a busca não encontra arquivos. Um clique no arquivo abre seu detalhe em painel lateral. Ao fechar o detalhe, inclusive quando aberto pela busca rápida, o mês continua expandido e o foco retorna ao arquivo na lista.
- **Busca rápida:** botão no topo ou atalho `⌘K` no Mac e `Ctrl+K` no Windows. Permite navegar pelas páginas, abrir diretamente uma fonte pagadora fictícia pelo nome, código ou ID, localizar competências com importações por mês/ano e encontrar arquivos importados. Selecionar uma competência abre o mês no Histórico; selecionar um arquivo abre também seu painel de detalhes.
- **Navegação por teclado:** o link “Ir para o conteúdo” salta a barra e a sidebar. A opção **Atalhos de teclado**, no menu do perfil, ou a tecla `?` abre um guia. `Tab` e `Shift+Tab` percorrem controles; em tabelas e listas com ações, `↑`/`↓` e `Home`/`End` percorrem linhas; `←`/`→` alternam abas e filtros; `Enter` ou `Espaço` ativam botões; `Esc` fecha painéis e diálogos. Os filtros de coluna do extrato recebem foco ao abrir e o devolvem ao botão ao fechar. Campos de texto e seletores mantêm os atalhos nativos. Isto é navegação operacional por teclado, não edição de células como em uma planilha.
- **Automação:** apenas uma entrada de navegação conceitual. O outro aplicativo não foi integrado.
- **Perfil:** identificação visual de Guilherme Vital, Estagiário de Backoffice; não existe autenticação real.
- **Feedback visual:** carregamento, sucesso e erro usam um padrão discreto de avisos nas telas de importação, conciliação e fontes pagadoras. Não há notificações persistidas em servidor.
- **Rascunho de lançamento:** ao tentar navegar para outra página com o formulário manual preenchido, o protótipo oferece continuar preenchendo ou descartar e sair. O rascunho vive só na memória da aba; recarregar a página o apaga. Visões salvas, observações e ações da trilha também ficam só na memória da aba. A trilha demonstra a apresentação de auditoria, sem registrar todas as alterações do aplicativo nem autenticar operadores.

O título da página de importação acompanha a aba: **Nova importação** ou **Histórico de importações**. No Histórico, o filtro superior é apenas **Empresa**, pois a lista reúne todas as competências dessa empresa. Competência e extrato aparecem na aba Nova importação.

No detalhe de um lote importado, os lançamentos aparecem primeiro **agrupados por fonte pagadora**, com o total associado a cada fonte. Ao expandir uma fonte, o usuário vê os valores individuais por artista e referência. Essa apresentação é uma simulação visual baseada nos lotes fictícios.

## Limites técnicos deste protótipo

- Frontend React, TypeScript e Vite em `royalties_ops/web`.
- `src/api.ts` é um adaptador **somente em memória**. Não faz `fetch`, não usa banco, API, armazenamento local ou autenticação. Recarregar a página restaura os dados iniciais.
- `src/mockData.ts` contém os dados de demonstração. As ações de importação simulam resultados; não interpretam o conteúdo de PDFs ou CSVs escolhidos pelo usuário.
- As atribuições de **Minhas pendências** são fictícias. A comparação lado a lado mostra os recebimentos do extrato selecionado e os lançamentos conhecidos na conciliação, sem efetuar validação financeira automática.
- A numeração **Envio 1, Envio 2…** no Histórico é calculada visualmente para arquivos com o mesmo nome dentro da mesma competência. Ela não representa versionamento persistente.
- O total mostrado no mês soma os lotes demonstrativos. **Ainda não foi definida** a regra de negócio para um reenvio substituir ou acrescentar valores; não transformar esse total em regra financeira oficial.
- A contagem de fontes no Histórico é calculada a partir dos detalhes fictícios dos lotes em memória. Uma integração real precisará definir um resumo agregado próprio para não carregar todos os lançamentos apenas para exibir essa contagem.
- Não há integração com PostgreSQL, backend, Hostinger, `app_automacao` ou o projeto oficial.

## Mapa para continuar o trabalho

| Arquivo | Responsabilidade |
| --- | --- |
| `royalties_ops/web/src/App.tsx` | Estrutura geral, sidebar, navegação e seleção temporária de empresa, competência, extrato e fonte da Conciliação |
| `royalties_ops/web/src/main.tsx`, `Spotlight.tsx` | Botão superior e busca rápida global |
| `royalties_ops/web/src/ReconciliationPage.tsx` | Contexto de empresa, competência e extrato; título das seções |
| `royalties_ops/web/src/ReconciliationOverviewPage.tsx` | Visão geral e detalhe de fonte |
| `royalties_ops/web/src/ReconciliationOperationPage.tsx` | Operação por fonte |
| `royalties_ops/web/src/sessionNotes.ts` | Tipos das observações e ações temporárias da sessão |
| `royalties_ops/web/src/ReconciliationImportPage.tsx` | Histórico mensal e painel lateral do arquivo |
| `royalties_ops/web/src/StatusNotice.tsx` | Avisos consistentes de carregamento, sucesso e erro |
| `royalties_ops/web/src/CatalogImportModal.tsx` | Fluxo fictício de importação de CSV |
| `royalties_ops/web/src/BankStatementsPage.tsx` | Histórico e importação demonstrativa de extratos |
| `royalties_ops/web/src/SourcesPage.tsx` | Fontes pagadoras |
| `royalties_ops/web/src/styles.css` | Estilos e refinamentos visuais |
| `royalties_ops/web/src/useRovingList.ts`, `keyboardTabs.ts`, `KeyboardHelp.tsx` | Navegação de linhas e abas por teclado e guia de atalhos |
| `royalties_ops/web/src/api.ts`, `mockData.ts`, `types.ts` | Adaptador local, dados fictícios e contratos de tipos |

## Orientações para continuar somente o Design Lab

1. Leia este README e inspecione a tela atual no navegador antes de alterar componentes. Trate prints e referências do usuário como direção visual, não como autorização para conectar dados reais.
2. Trabalhe **somente neste Design Lab**, mantendo os fluxos fictícios. Não modifique o projeto oficial nem conecte serviços externos sem um pedido novo e explícito.
3. Preserve a linguagem visual aprovada: fundo branco ou cinza muito claro, azul suave em ações e seleção, bordas discretas, títulos facilmente identificáveis, espaçamento generoso e densidade adequada a uma ferramenta financeira operacional. Evite grids repetitivos de cards, KPIs grandes e legendas decorativas.
4. Faça mudanças incrementais e crie um checkpoint local antes de uma alteração ampla de layout. Os diretórios em `checkpoints/` são cópias locais de reversão, não parte necessária do aplicativo.
5. Use somente dados sintéticos. Para validar, execute `npm run build` e confira a tela no navegador em desktop, incluindo a interação alterada.
6. Ao reportar, diga o que mudou, os arquivos alterados e as limitações. Não apresente comportamentos simulados como integrações concluídas.

Mensagem sugerida ao abrir **este laboratório** no Codex em outro computador:

> Leia o `README.md` e examine `royalties_ops/web` antes de editar. Continue apenas o MUV Royalties Design Lab V1 com dados fictícios. Preserve o layout já aprovado e proponha mudanças incrementais. Nesta sessão, implemente somente o pedido que eu fizer, valide com `npm run build` e no navegador, e reporte arquivos alterados e limites. Não conecte backend nem o projeto oficial por iniciativa própria.

### Decisão adiada

O significado financeiro de reenviar um arquivo com o mesmo nome — **somar um novo lote ou substituir o anterior** — ficou para discussão futura. Não implemente uma das opções por suposição.

## Publicação

`node_modules/`, `dist/` e `checkpoints/` permanecem fora do repositório. Não há commit nem push automático ao executar o aplicativo.

### Recuperar o layout anterior às cinco melhorias

O commit [`3ae553e`](https://github.com/guivital1/esbo-o/commit/3ae553e) na branch `main` é o checkpoint publicado antes desta rodada. As cinco melhorias ficam na branch `feat/next-five-ux`. Para abrir o estado anterior em outra cópia do repositório:

```bash
git clone https://github.com/guivital1/esbo-o.git
cd esbo-o
git switch main
cd royalties_ops/web
npm ci
npm run dev
```

Para comparar a nova proposta, execute `git switch feat/next-five-ux` na raiz do repositório e recarregue o navegador. Trocar de branch requer uma árvore de trabalho sem alterações locais pendentes.
