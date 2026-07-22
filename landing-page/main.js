/* ==========================================================================
   Hallucinated Talles — Landing Page Animations
   ========================================================================== */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Multi-language support
  // -----------------------------------------------------------------------
  const translations = {
    en: {
      'page-title':        'Hallucinated Talles \u2014 A Free Writing Studio for Long-Form Fiction',
      'nav-logo':          'Hallucinated Talles',
      'nav-features':      'Features',
      'nav-ai-tools':      'AI Tools',
      'nav-planner':       'Planner',
      'nav-download':      'Download Free',
      'hero-eyebrow':      'Free &amp; Open Source',
      'hero-title':        'Write Longer.<br><em>Write Deeper.</em>',
      'hero-subtitle':     'A writing studio built for novels, screenplays, and world-building projects. Organize chapters, track characters, map timelines \u2014 with AI that understands your story.',
      'hero-download-btn': 'Download for Free',
      'hero-github-btn':   'View on GitHub',
      'features-eyebrow':  'What Hallucinated Talles gives you',
      'features-title':    'A writing studio<br><em>that gets out of your way.</em>',
      'feature-1-title':   'The Writing Surface',
      'feature-1-desc':    'A clean, page-based editor that feels like a real manuscript. No clutter, no distractions. Just your words on a cream page, with formatting that stays out of your way. Auto-save means you never lose a sentence, and the chapter tree lets you jump between acts without losing your place.',
      'feature-2-title':   'Your AI Writing Partner',
      'feature-2-desc':    'You\u2019re deep in Chapter 7 and need to check what you wrote about Elena\u2019s childhood in Chapter 2. Instead of scrolling endlessly, ask your AI \u2014 it knows your whole story. It suggests prose, polishes dialogue, and helps you break through writer\u2019s block without losing your voice.',
      'feature-3-title':   'Know Your Cast',
      'feature-3-desc':    'Every character deserves more than a sticky note. Track motivations, flaws, relationships, and arcs in one place. Build a living world bible with maps, lore, and magic systems that your AI can reference at any depth.',
      'feature-4-title':   'See the Shape of Your Story',
      'feature-4-desc':    'Before you write a single word, map your narrative visually. Drag chapters, scenes, and beats onto an infinite canvas. See how Act I connects to Act III. Watch the timeline unfold and make sure every thread pays off.',
      'feature-5-title':   'Bring It In, Send It Out',
      'feature-5-desc':    'Drop in a PDF, DOCX, or TXT file and watch AI build your world. It detects characters, events, relationships, and chapters \u2014 so your manuscript is ready to work with from the moment it lands. When you\u2019re done, export a polished manuscript with custom page size, margins, and fonts.',
      'ai-eyebrow':        'AI-Powered',
      'ai-title':          'Meet Your AI<br><em>Writing Partner</em>',
      'ai-desc':           'Your built-in AI assistant understands your story\u2019s full context \u2014 characters, plot, tone, and world. It helps you break through writer\u2019s block, polish prose, and develop deeper character arcs.',
      'ai-list-1':         '<strong>Context-aware</strong> of your characters, plot, and world',
      'ai-list-2':         '<strong>Suggests prose</strong>, dialogue, descriptions, and scene transitions',
      'ai-list-3':         '<strong>Makes edits</strong> you can accept or reject with one click',
      'ai-list-4':         '<strong>Sub-agents</strong> handle specialized writing tasks autonomously',
      'ai-list-5':         '<strong>Works offline</strong> \u2014 run models locally on your machine, fully private',
      'planner-eyebrow':   'Visual Planning',
      'planner-title':     'Plan Every<br><em>Beat.</em>',
      'planner-desc':      'Map your story visually. Drag chapters, scenes, and beats onto an infinite canvas. See the shape of your narrative before you write a single word.',
      'planner-list-1':    '<strong>Visual node graph</strong> \u2014 chapters, scenes, beats, notes',
      'planner-list-2':    '<strong>AI auto-layout</strong> \u2014 dagre-powered graph organization',
      'planner-list-3':    '<strong>Edge types</strong> \u2014 follows, causes, conflicts, resolves',
      'planner-list-4':    '<strong>Connected to AI</strong> \u2014 generate story content from your plan',
      'import-eyebrow':    'Import &amp; Export',
      'import-title':      'Bring Your<br><em>Manuscript.</em>',
      'import-desc':       'Drop in a draft and watch AI build your world. It detects characters, events, relationships, and chapters \u2014 so your story is ready to work with immediately. When you\u2019re done, export a polished manuscript for your editor or beta readers.',
      'import-list-1':     '<strong>Multi-format</strong> \u2014 PDF, DOCX, ODT, TXT',
      'import-list-2':     '<strong>Entity extraction</strong> \u2014 characters, events, relationships, and chapters',
      'import-list-3':     '<strong>Manuscript export</strong> with custom page size, margins, and fonts',
      'import-list-4':     '<strong>Non-destructive</strong> \u2014 your original files stay untouched',
      'dash-eyebrow':      'Analytics',
      'dash-title':        'Track Your<br><em>AI Usage.</em>',
      'dash-desc':         'See exactly how your AI writing sessions add up. Monitor tokens, costs, and efficiency across providers and models \u2014 so you can optimize your workflow.',
      'dash-list-1':       '<strong>Real-time tracking</strong> \u2014 see token usage as you write',
      'dash-list-2':       '<strong>Per-session breakdowns</strong> \u2014 compare usage across sessions',
      'dash-list-3':       '<strong>Model comparison</strong> \u2014 see which providers you use most',
      'dash-list-4':       '<strong>Visual dashboards</strong> \u2014 charts, KPIs, and summaries',
      'stack-eyebrow':     'Built for writers, built to last',
      'stack-title':       'Your stories, always available.<br><em>No accounts. No subscriptions.</em>',
      'stack-card-1-title':'Your Data Stays Yours',
      'stack-card-1-desc': 'No telemetry, no accounts, no data leaving your machine. Connect to your own locally hosted models and keep everything private.',
      'stack-card-2-title':'Cloud Providers Welcome',
      'stack-card-2-desc': 'Prefer cloud AI? Connect OpenAI, Google, or others in seconds. Switch providers anytime without changing your workflow.',
      'stack-card-3-title':'Shape the AI\u2019s Voice',
      'stack-card-3-desc': 'Define custom personas and writing instructions that shape how the AI thinks, writes, and suggests for your specific project and genre.',
      'stack-card-4-title':'Free. Open Source. Forever.',
      'stack-card-4-desc': 'No accounts, no subscriptions, no BS. Inspect the code, contribute features, fork it for your needs. Always free.',
      'cta-eyebrow':       'Your story begins here',
      'cta-title':         'Start Writing.',
      'cta-desc':          'Download Hallucinated Talles for free. Write offline, use any AI you want, and keep your work on your machine \u2014 where it belongs.',
      'cta-download-btn':  'Download for Free',
      'cta-star-btn':      'Star on GitHub',
      'cta-note':          'Windows &middot; macOS &middot; Linux &middot; Always free',
      'footer-brand':      'Hallucinated Talles',
      'footer-link-github':'GitHub',
      'footer-link-releases':'Releases',
      'footer-link-bug':   'Report a Bug',
      'footer-link-license':'License',
      'footer-copy':       '&copy; 2026 Hallucinated Talles &middot; Free &amp; Open Source',
    },

    es: {
      'page-title':        'Hallucinated Talles \u2014 Un estudio de escritura gratuito para ficci\u00f3n de formato largo',
      'nav-logo':          'Hallucinated Talles',
      'nav-features':      'Funcionalidades',
      'nav-ai-tools':      'Herramientas de IA',
      'nav-planner':       'Planificador',
      'nav-download':      'Descargar Gratis',
      'hero-eyebrow':      'Gratuito y Open Source',
      'hero-title':        'Escribe M\u00e1s.<br><em>Escribe M\u00e1s Profundo.</em>',
      'hero-subtitle':     'Un estudio de escritura creado para novelas, guiones y proyectos de creaci\u00f3n de mundos. Organiza cap\u00edtulos, da seguimiento a personajes, traza l\u00edneas de tiempo \u2014 con una IA que entiende tu historia.',
      'hero-download-btn': 'Descargar Gratis',
      'hero-github-btn':   'Ver en GitHub',
      'features-eyebrow':  'Lo que Hallucinated Talles te ofrece',
      'features-title':    'Un estudio de escritura<br><em>que no se interpone en tu camino.</em>',
      'feature-1-title':   'La Superficie de Escritura',
      'feature-1-desc':    'Un editor limpio basado en p\u00e1ginas que se siente como un manuscrito real. Sin desorden, sin distracciones. Solo tus palabras en una p\u00e1gina crema, con un formato que no estorba. El guardado autom\u00e1tico significa que nunca pierdes una frase, y el \u00e1rbol de cap\u00edtulos te permite saltar entre actos sin perder tu lugar.',
      'feature-2-title':   'Tu Compa\u00f1ero de Escritura con IA',
      'feature-2-desc':    'Est\u00e1s en el Cap\u00edtulo 7 y necesitas verificar lo que escribiste sobre la infancia de Elena en el Cap\u00edtulo 2. En lugar de desplazarte sin cesar, preg\u00fantale a tu IA \u2014 conoce toda tu historia. Sugiere prosa, pule di\u00e1logos y te ayuda a superar el bloqueo del escritor sin perder tu voz.',
      'feature-3-title':   'Conoce a tus Personajes',
      'feature-3-desc':    'Cada personaje merece m\u00e1s que una nota adhesiva. Haz seguimiento de motivaciones, defectos, relaciones y arcos en un solo lugar. Construye una biblia de mundo viva con mapas, tradiciones y sistemas de magia que tu IA puede consultar a cualquier profundidad.',
      'feature-4-title':   'Ve la Forma de tu Historia',
      'feature-4-desc':    'Antes de escribir una sola palabra, traza tu narrativa visualmente. Arrastra cap\u00edtulos, escenas y momentos clave a un lienzo infinito. Ve c\u00f3mo el Acto I se conecta con el Acto III. Observa c\u00f3mo se desarrolla la l\u00ednea de tiempo y aseg\u00farate de que cada hilo tenga su desenlace.',
      'feature-5-title':   'Importa y Exporta',
      'feature-5-desc':    'Arrastra un archivo PDF, DOCX o TXT y observa c\u00f3mo la IA construye tu mundo. Detecta personajes, eventos, relaciones y cap\u00edtulos \u2014 para que tu manuscrito est\u00e9 listo para trabajar desde el momento en que llega. Cuando termines, exporta un manuscrito pulido con tama\u00f1o de p\u00e1gina, m\u00e1rgenes y fuentes personalizados.',
      'ai-eyebrow':        'Impulsado por IA',
      'ai-title':          'Conoce a tu<br><em>Compa\u00f1ero de IA</em>',
      'ai-desc':           'Tu asistente de IA integrado entiende el contexto completo de tu historia \u2014 personajes, trama, tono y mundo. Te ayuda a superar el bloqueo del escritor, pulir la prosa y desarrollar arcos de personajes m\u00e1s profundos.',
      'ai-list-1':         '<strong>Consciente del contexto</strong> de tus personajes, trama y mundo',
      'ai-list-2':         '<strong>Sugiere prosa</strong>, di\u00e1logos, descripciones y transiciones de escenas',
      'ai-list-3':         '<strong>Hace ediciones</strong> que puedes aceptar o rechazar con un clic',
      'ai-list-4':         '<strong>Subagentes</strong> manejan tareas de escritura especializadas de forma aut\u00f3noma',
      'ai-list-5':         '<strong>Funciona sin conexi\u00f3n</strong> \u2014 ejecuta modelos localmente en tu m\u00e1quina, totalmente privado',
      'planner-eyebrow':   'Planificaci\u00f3n Visual',
      'planner-title':     'Planifica Cada<br><em>Momento Clave.</em>',
      'planner-desc':      'Traza tu historia visualmente. Arrastra cap\u00edtulos, escenas y momentos clave a un lienzo infinito. Ve la forma de tu narrativa antes de escribir una sola palabra.',
      'planner-list-1':    '<strong>Grafo de nodos visual</strong> \u2014 cap\u00edtulos, escenas, momentos, notas',
      'planner-list-2':    '<strong>Dise\u00f1o autom\u00e1tico con IA</strong> \u2014 organizaci\u00f3n de grafos impulsada por dagre',
      'planner-list-3':    '<strong>Tipos de aristas</strong> \u2014 sigue, causa, conflicto, resuelve',
      'planner-list-4':    '<strong>Conectado a la IA</strong> \u2014 genera contenido narrativo desde tu plan',
      'import-eyebrow':    'Importar y Exportar',
      'import-title':      'Trae tu<br><em>Manuscrito.</em>',
      'import-desc':       'Arrastra un borrador y observa c\u00f3mo la IA construye tu mundo. Detecta personajes, eventos, relaciones y cap\u00edtulos \u2014 para que tu historia est\u00e9 lista para trabajar de inmediato. Cuando termines, exporta un manuscrito pulido para tu editor o lectores beta.',
      'import-list-1':     '<strong>Multiformato</strong> \u2014 PDF, DOCX, ODT, TXT',
      'import-list-2':     '<strong>Extracci\u00f3n de entidades</strong> \u2014 personajes, eventos, relaciones y cap\u00edtulos',
      'import-list-3':     '<strong>Exportaci\u00f3n de manuscrito</strong> con tama\u00f1o de p\u00e1gina, m\u00e1rgenes y fuentes personalizados',
      'import-list-4':     '<strong>No destructivo</strong> \u2014 tus archivos originales permanecen intactos',
      'dash-eyebrow':      'Anal\u00edticas',
      'dash-title':        'Controla tu<br><em>Uso de IA.</em>',
      'dash-desc':         'Ve exactamente c\u00f3mo se acumulan tus sesiones de escritura con IA. Monitorea tokens, costos y eficiencia entre proveedores y modelos \u2014 para que puedas optimizar tu flujo de trabajo.',
      'dash-list-1':       '<strong>Seguimiento en tiempo real</strong> \u2014 ve el uso de tokens mientras escribes',
      'dash-list-2':       '<strong>Desgloses por sesi\u00f3n</strong> \u2014 compara el uso entre sesiones',
      'dash-list-3':       '<strong>Comparaci\u00f3n de modelos</strong> \u2014 ve qu\u00e9 proveedores usas m\u00e1s',
      'dash-list-4':       '<strong>Paneles visuales</strong> \u2014 gr\u00e1ficos, KPIs y res\u00famenes',
      'stack-eyebrow':     'Construido para escritores, construido para durar',
      'stack-title':       'Tus historias, siempre disponibles.<br><em>Sin cuentas. Sin suscripciones.</em>',
      'stack-card-1-title':'Tus Datos Siguen Siendo Tuyos',
      'stack-card-1-desc': 'Sin telemetr\u00eda, sin cuentas, sin datos que salgan de tu m\u00e1quina. Con\u00e9ctate a tus propios modelos alojados localmente y mant\u00e9n todo privado.',
      'stack-card-2-title':'Proveedores en la Nube Bienvenidos',
      'stack-card-2-desc': '\u00bfPrefieres IA en la nube? Conecta OpenAI, Google u otros en segundos. Cambia de proveedor en cualquier momento sin modificar tu flujo de trabajo.',
      'stack-card-3-title':'Dale Forma a la Voz de la IA',
      'stack-card-3-desc': 'Define personas personalizadas e instrucciones de escritura que moldeen c\u00f3mo la IA piensa, escribe y sugiere para tu proyecto y g\u00e9nero espec\u00edficos.',
      'stack-card-4-title':'Gratis. Open Source. Para Siempre.',
      'stack-card-4-desc': 'Sin cuentas, sin suscripciones, sin tonter\u00edas. Inspecciona el c\u00f3digo, contribuye con funciones, haz un fork para tus necesidades. Siempre gratis.',
      'cta-eyebrow':       'Tu historia comienza aqu\u00ed',
      'cta-title':         'Empieza a Escribir.',
      'cta-desc':          'Descarga Hallucinated Talles gratis. Escribe sin conexi\u00f3n, usa cualquier IA que quieras y mant\u00e9n tu trabajo en tu m\u00e1quina \u2014 donde debe estar.',
      'cta-download-btn':  'Descargar Gratis',
      'cta-star-btn':      'Estrella en GitHub',
      'cta-note':          'Windows &middot; macOS &middot; Linux &middot; Siempre gratis',
      'footer-brand':      'Hallucinated Talles',
      'footer-link-github':'GitHub',
      'footer-link-releases':'Lanzamientos',
      'footer-link-bug':   'Reportar un Error',
      'footer-link-license':'Licencia',
      'footer-copy':       '&copy; 2026 Hallucinated Talles &middot; Gratis y Open Source',
    },

    'pt-BR': {
      'page-title':        'Hallucinated Talles \u2014 Um est\u00fadio de escrita gratuito para fic\u00e7\u00e3o de formato longo',
      'nav-logo':          'Hallucinated Talles',
      'nav-features':      'Recursos',
      'nav-ai-tools':      'Ferramentas de IA',
      'nav-planner':       'Planejador',
      'nav-download':      'Baixar Gr\u00e1tis',
      'hero-eyebrow':      'Gr\u00e1tis e Open Source',
      'hero-title':        'Escreva Mais.<br><em>Escreva Mais Profundo.</em>',
      'hero-subtitle':     'Um est\u00fadio de escrita criado para romances, roteiros e projetos de constru\u00e7\u00e3o de mundos. Organize cap\u00edtulos, acompanhe personagens, mapeie linhas do tempo \u2014 com IA que entende sua hist\u00f3ria.',
      'hero-download-btn': 'Baixar Gr\u00e1tis',
      'hero-github-btn':   'Ver no GitHub',
      'features-eyebrow':  'O que Hallucinated Talles oferece a voc\u00ea',
      'features-title':    'Um est\u00fadio de escrita<br><em>que n\u00e3o atrapalha.</em>',
      'feature-1-title':   'A Superf\u00edcie de Escrita',
      'feature-1-desc':    'Um editor limpo baseado em p\u00e1ginas que parece um manuscrito de verdade. Sem bagun\u00e7a, sem distra\u00e7\u00f5es. Apenas suas palavras em uma p\u00e1gina creme, com formata\u00e7\u00e3o que n\u00e3o atrapalha. O salvamento autom\u00e1tico significa que voc\u00ea nunca perde uma frase, e a \u00e1rvore de cap\u00edtulos permite que voc\u00ea salte entre atos sem perder seu lugar.',
      'feature-2-title':   'Seu Parceiro de Escrita com IA',
      'feature-2-desc':    'Voc\u00ea est\u00e1 no Cap\u00edtulo 7 e precisa verificar o que escreveu sobre a inf\u00e2ncia de Elena no Cap\u00edtulo 2. Em vez de rolar infinitamente, pergunte \u00e0 sua IA \u2014 ela conhece toda a sua hist\u00f3ria. Sugere prosa, polida di\u00e1logos e ajuda a superar o bloqueio criativo sem perder sua voz.',
      'feature-3-title':   'Conhece seu Elenco',
      'feature-3-desc':    'Cada personagem merece mais que um post-it. Acompanhe motiva\u00e7\u00f5es, defeitos, relacionamentos e arcos em um s\u00f3 lugar. Construa uma b\u00edblia de mundo viva com mapas, lore e sistemas de magia que sua IA pode consultar em qualquer profundidade.',
      'feature-4-title':   'Veja a Forma da Sua Hist\u00f3ria',
      'feature-4-desc':    'Antes de escrever uma \u00fanica palavra, mapeie sua narrativa visualmente. Arraste cap\u00edtulos, cenas e batidas para uma tela infinita. Veja como o Ato I se conecta ao Ato III. Observe a linha do tempo se desenrolar e garanta que cada fio seja conclu\u00eddo.',
      'feature-5-title':   'Importe e Exporte',
      'feature-5-desc':    'Solte um arquivo PDF, DOCX ou TXT e veja a IA construir seu mundo. Ela detecta personagens, eventos, relacionamentos e cap\u00edtulos \u2014 para que seu manuscrito esteja pronto para trabalhar desde o momento em que chega. Quando terminar, exporte um manuscrito polido com tamanho de p\u00e1gina, margens e fontes personalizados.',
      'ai-eyebrow':        'Alimentado por IA',
      'ai-title':          'Conhe\u00e7a seu<br><em>Parceiro de IA</em>',
      'ai-desc':           'Seu assistente de IA integrado entende o contexto completo da sua hist\u00f3ria \u2014 personagens, trama, tom e mundo. Ele ajuda a superar o bloqueio criativo, polir a prosa e desenvolver arcos de personagens mais profundos.',
      'ai-list-1':         '<strong>Consciente do contexto</strong> dos seus personagens, trama e mundo',
      'ai-list-2':         '<strong>Sugere prosa</strong>, di\u00e1logos, descri\u00e7\u00f5es e transi\u00e7\u00f5es de cena',
      'ai-list-3':         '<strong>Faz edi\u00e7\u00f5es</strong> que voc\u00ea pode aceitar ou rejeitar com um clique',
      'ai-list-4':         '<strong>Subagentes</strong> lidam com tarefas especializadas de escrita de forma aut\u00f4noma',
      'ai-list-5':         '<strong>Funciona offline</strong> \u2014 execute modelos localmente na sua m\u00e1quina, totalmente privado',
      'planner-eyebrow':   'Planejamento Visual',
      'planner-title':     'Planeje Cada<br><em>Batida.</em>',
      'planner-desc':      'Mapeie sua hist\u00f3ria visualmente. Arraste cap\u00edtulos, cenas e batidas para uma tela infinita. Veja a forma da sua narrativa antes de escrever uma \u00fanica palavra.',
      'planner-list-1':    '<strong>Grafo de n\u00f3s visual</strong> \u2014 cap\u00edtulos, cenas, batidas, notas',
      'planner-list-2':    '<strong>Layout autom\u00e1tico com IA</strong> \u2014 organiza\u00e7\u00e3o de grafo com dagre',
      'planner-list-3':    '<strong>Tipos de arestas</strong> \u2014 segue, causa, conflito, resolve',
      'planner-list-4':    '<strong>Conectado \u00e0 IA</strong> \u2014 gere conte\u00fado narrativo a partir do seu plano',
      'import-eyebrow':    'Importar e Exportar',
      'import-title':      'Traga seu<br><em>Manuscrito.</em>',
      'import-desc':       'Solte um rascunho e veja a IA construir seu mundo. Ela detecta personagens, eventos, relacionamentos e cap\u00edtulos \u2014 para que sua hist\u00f3ria esteja pronta para trabalhar imediatamente. Quando terminar, exporte um manuscrito polido para seu editor ou leitores beta.',
      'import-list-1':     '<strong>Multiformato</strong> \u2014 PDF, DOCX, ODT, TXT',
      'import-list-2':     '<strong>Extra\u00e7\u00e3o de entidades</strong> \u2014 personagens, eventos, relacionamentos e cap\u00edtulos',
      'import-list-3':     '<strong>Exporta\u00e7\u00e3o de manuscrito</strong> com tamanho de p\u00e1gina, margens e fontes personalizados',
      'import-list-4':     '<strong>N\u00e3o destrutivo</strong> \u2014 seus arquivos originais permanecem intactos',
      'dash-eyebrow':      'Anal\u00edticas',
      'dash-title':        'Monitore seu<br><em>Uso de IA.</em>',
      'dash-desc':         'Veja exatamente como suas sess\u00f5es de escrita com IA se acumulam. Monitore tokens, custos e efici\u00eancia entre provedores e modelos \u2014 para que voc\u00ea possa otimizar seu fluxo de trabalho.',
      'dash-list-1':       '<strong>Acompanhamento em tempo real</strong> \u2014 veja o uso de tokens enquanto escreve',
      'dash-list-2':       '<strong>Detalhamento por sess\u00e3o</strong> \u2014 compare o uso entre sess\u00f5es',
      'dash-list-3':       '<strong>Compara\u00e7\u00e3o de modelos</strong> \u2014 veja quais provedores voc\u00ea usa mais',
      'dash-list-4':       '<strong>Pain\u00e9is visuais</strong> \u2014 gr\u00e1ficos, KPIs e resumos',
      'stack-eyebrow':     'Feito para escritores, feito para durar',
      'stack-title':       'Suas hist\u00f3rias, sempre dispon\u00edveis.<br><em>Sem contas. Sem assinaturas.</em>',
      'stack-card-1-title':'Seus Dados S\u00e3o Seus',
      'stack-card-1-desc': 'Sem telemetria, sem contas, sem dados saindo da sua m\u00e1quina. Conecte-se aos seus pr\u00f3prios modelos hospedados localmente e mantenha tudo privado.',
      'stack-card-2-title':'Provedores de Nuvem Bem-vindos',
      'stack-card-2-desc': 'Prefere IA na nuvem? Conecte OpenAI, Google ou outros em segundos. Troque de provedor a qualquer momento sem alterar seu fluxo de trabalho.',
      'stack-card-3-title':'Molde a Voz da IA',
      'stack-card-3-desc': 'Defina personas personalizadas e instru\u00e7\u00f5es de escrita que moldam como a IA pensa, escreve e sugere para seu projeto e g\u00eanero espec\u00edficos.',
      'stack-card-4-title':'Gr\u00e1tis. Open Source. Para Sempre.',
      'stack-card-4-desc': 'Sem contas, sem assinaturas, sem enrola\u00e7\u00e3o. Inspecione o c\u00f3digo, contribua com recursos, fa\u00e7a um fork para suas necessidades. Sempre gr\u00e1tis.',
      'cta-eyebrow':       'Sua hist\u00f3ria come\u00e7a aqui',
      'cta-title':         'Comece a Escrever.',
      'cta-desc':          'Baixe o Hallucinated Talles gr\u00e1tis. Escreva offline, use qualquer IA que quiser e mantenha seu trabalho na sua m\u00e1quina \u2014 onde ele pertence.',
      'cta-download-btn':  'Baixar Gr\u00e1tis',
      'cta-star-btn':      'Estrela no GitHub',
      'cta-note':          'Windows &middot; macOS &middot; Linux &middot; Sempre gr\u00e1tis',
      'footer-brand':      'Hallucinated Talles',
      'footer-link-github':'GitHub',
      'footer-link-releases':'Lan\u00e7amentos',
      'footer-link-bug':   'Relatar um Bug',
      'footer-link-license':'Licen\u00e7a',
      'footer-copy':       '&copy; 2026 Hallucinated Talles &middot; Gr\u00e1tis e Open Source',
    },

    'zh-CN': {
      'page-title':        'Hallucinated Talles \u2014\u2014 \u957f\u7bc7\u5c0f\u8bf4\u514d\u8d39\u5199\u4f5c\u5de5\u4f5c\u5ba4',
      'nav-logo':          'Hallucinated Talles',
      'nav-features':      '\u529f\u80fd\u7279\u6027',
      'nav-ai-tools':      'AI \u5de5\u5177',
      'nav-planner':       '\u89c4\u5212\u5668',
      'nav-download':      '\u514d\u8d39\u4e0b\u8f7d',
      'hero-eyebrow':      '\u514d\u8d39\u4e0e\u5f00\u6e90',
      'hero-title':        '\u5199\u5f97\u66f4\u957f\u3002<br><em>\u5199\u5f97\u66f4\u6df1\u3002</em>',
      'hero-subtitle':     '\u4e00\u4e2a\u4e3a\u957f\u7bc7\u5c0f\u8bf4\u3001\u5267\u672c\u548c\u4e16\u754c\u6784\u5efa\u9879\u76ee\u800c\u751f\u7684\u5199\u4f5c\u5de5\u4f5c\u5ba4\u3002\u7ec4\u7ec7\u7ae0\u8282\u3001\u8ddf\u8e2a\u89d2\u8272\u3001\u6e2f\u753b\u65f6\u95f4\u7ebf \u2014\u2014 \u4f7f\u7528\u7406\u89e3\u60a8\u6545\u4e8b\u7684 AI \u3002',
      'hero-download-btn': '\u514d\u8d39\u4e0b\u8f7d',
      'hero-github-btn':   '\u5728 GitHub \u4e0a\u67e5\u770b',
      'features-eyebrow':  'Hallucinated Talles \u4e3a\u60a8\u63d0\u4f9b\u7684',
      'features-title':    '\u4e00\u4e2a<br><em>\u4e0d\u6253\u6270\u60a8\u7684\u5199\u4f5c\u5de5\u4f5c\u5ba4\u3002</em>',
      'feature-1-title':   '\u5199\u4f5c\u9762\u677f',
      'feature-1-desc':    '\u4e00\u4e2a\u5e72\u51c0\u3001\u57fa\u4e8e\u9875\u9762\u7684\u7f16\u8f91\u5668\uff0c\u611f\u89c9\u5c31\u50cf\u771f\u5b9e\u7684\u624b\u7a3f\u3002\u6ca1\u6709\u6742\u4e71\uff0c\u6ca1\u6709\u5206\u5fc3\u3002\u60a8\u7684\u6587\u5b57\u53ea\u662f\u5728\u4e00\u5f20\u5976\u6cb9\u8272\u9875\u9762\u4e0a\uff0c\u6392\u7248\u4e0d\u4f1a\u6253\u6270\u60a8\u3002\u81ea\u52a8\u4fdd\u5b58\u610f\u5473\u60a8\u4ece\u4e0d\u4f1a\u4e22\u5931\u4efb\u4f55\u5b57\u53e5\uff0c\u7ae0\u8282\u6811\u8ba9\u60a8\u53ef\u4ee5\u5728\u4e0d\u5931\u53bb\u4f4d\u7f6e\u7684\u60c5\u51b5\u4e0b\u8df3\u8f6c\u4e0d\u540c\u5e55\u3002',
      'feature-2-title':   '\u60a8\u7684 AI \u5199\u4f5c\u4f19\u4f34',
      'feature-2-desc':    '\u60a8\u6b63\u5728\u7b2c 7 \u7ae0\u6df1\u5165\u5199\u4f5c\uff0c\u9700\u8981\u67e5\u770b\u7b2c 2 \u7ae0\u5173\u4e8e Elena \u7ae5\u5e74\u7684\u5185\u5bb9\u3002\u4e0d\u7528\u6ca1\u5b8c\u6ca1\u4e86\u5730\u6eda\u52a8\uff0c\u76f4\u63a5\u95ee\u60a8\u7684 AI \u2014\u2014 \u5b83\u4e86\u89e3\u6574\u4e2a\u6545\u4e8b\u3002\u5b83\u63d0\u4f9b\u6563\u6587\u5efa\u8bae\u3001\u78e8\u70bc\u5bf9\u767d\uff0c\u5e2e\u52a9\u60a8\u7a81\u7834\u5199\u4f5c\u74f6\u9888\uff0c\u540c\u65f6\u4fdd\u6301\u60a8\u7684\u72ec\u7279\u58f0\u97f3\u3002',
      'feature-3-title':   '\u4e86\u89e3\u60a8\u7684\u89d2\u8272',
      'feature-3-desc':    '\u6bcf\u4e2a\u89d2\u8272\u90fd\u503c\u5f97\u66f4\u591a\u800c\u975e\u53ea\u662f\u4e00\u5f20\u4fbf\u7b7e\u3002\u5728\u4e00\u4e2a\u5730\u65b9\u8ddf\u8e2a\u52a8\u673a\u3001\u7f3a\u70b9\u3001\u5173\u7cfb\u548c\u6210\u957f\u5f27\u7ebf\u3002\u6784\u5efa\u4e00\u4e2a\u6d3b\u7684\u4e16\u754c\u5723\u7ecf\uff0c\u5305\u542b\u5730\u56fe\u3001\u4f20\u8bf4\u548c\u9b54\u6cd5\u4f53\u7cfb\uff0c\u60a8\u7684 AI \u53ef\u4ee5\u968f\u65f6\u67e5\u9605\u4efb\u4f55\u6df1\u5ea6\u7684\u4fe1\u606f\u3002',
      'feature-4-title':   '\u67e5\u770b\u60a8\u6545\u4e8b\u7684\u5f62\u6001',
      'feature-4-desc':    '\u5728\u60a8\u5199\u4e0b\u7b2c\u4e00\u4e2a\u5b57\u4e4b\u524d\uff0c\u53ef\u89c6\u5316\u5730\u7ed8\u5236\u60a8\u7684\u53d9\u4e8b\u3002\u5c06\u7ae0\u8282\u3001\u573a\u666f\u548c\u8282\u62cd\u62d6\u62fd\u5230\u65e0\u9650\u753b\u5e03\u4e0a\u3002\u67e5\u770b\u7b2c\u4e00\u5e55\u5982\u4f55\u8fde\u63a5\u5230\u7b2c\u4e09\u5e55\u3002\u89c2\u770b\u65f6\u95f4\u7ebf\u5c55\u5f00\uff0c\u786e\u4fdd\u6bcf\u4e00\u6761\u6545\u4e8b\u7ebf\u90fd\u6709\u53d1\u5c55\u3002',
      'feature-5-title':   '\u5bfc\u5165\u4e0e\u5bfc\u51fa',
      'feature-5-desc':    '\u6295\u5165 PDF\u3001DOCX \u6216 TXT \u6587\u4ef6\uff0c\u89c2\u770b AI \u6784\u5efa\u60a8\u7684\u4e16\u754c\u3002\u5b83\u4f1a\u81ea\u52a8\u68c0\u6d4b\u89d2\u8272\u3001\u4e8b\u4ef6\u3001\u5173\u7cfb\u548c\u7ae0\u8282 \u2014\u2014 \u60a8\u7684\u624b\u7a3f\u4ece\u843d\u5730\u7684\u90a3\u4e00\u523b\u5c31\u53ef\u4ee5\u5f00\u59cb\u5de5\u4f5c\u3002\u5f53\u60a8\u5b8c\u6210\u540e\uff0c\u53ef\u4ee5\u5bfc\u51fa\u6d01\u51c0\u7684\u624b\u7a3f\uff0c\u5e76\u81ea\u5b9a\u4e49\u9875\u9762\u5927\u5c0f\u3001\u8fb9\u8ddd\u548c\u5b57\u4f53\u3002',
      'ai-eyebrow':        'AI \u9a71\u52a8',
      'ai-title':          '\u8ba4\u8bc6\u60a8\u7684<br><em>AI \u5199\u4f5c\u4f19\u4f34</em>',
      'ai-desc':           '\u60a8\u5185\u7f6e\u7684 AI \u52a9\u624b\u4e86\u89e3\u60a8\u6545\u4e8b\u7684\u5168\u90e8\u80cc\u666f \u2014\u2014 \u89d2\u8272\u3001\u5267\u60c5\u3001\u8bed\u8c03\u548c\u4e16\u754c\u3002\u5b83\u5e2e\u52a9\u60a8\u7a81\u7834\u5199\u4f5c\u74f6\u9888\u3001\u78e8\u70bc\u6563\u6587\u548c\u53d1\u5c55\u66f4\u6df1\u523b\u7684\u89d2\u8272\u6210\u957f\u5f27\u7ebf\u3002',
      'ai-list-1':         '<strong>\u4e86\u89e3\u60a8\u7684\u89d2\u8272\u3001\u5267\u60c5\u548c\u4e16\u754c\u80cc\u666f</strong>',
      'ai-list-2':         '<strong>\u63d0\u4f9b\u6563\u6587\u5efa\u8bae</strong>\u3001\u5bf9\u767d\u3001\u63cf\u5199\u548c\u573a\u666f\u8fc7\u6e21',
      'ai-list-3':         '<strong>\u7f16\u8f91\u7a3f\u4ef6</strong>\uff0c\u60a8\u53ef\u4ee5\u4e00\u952e\u63a5\u53d7\u6216\u62d2\u7edd',
      'ai-list-4':         '<strong>\u5b50\u4ee3\u7406</strong>\u81ea\u4e3b\u5904\u7406\u4e13\u4e1a\u5199\u4f5c\u4efb\u52a1',
      'ai-list-5':         '<strong>\u79bb\u7ebf\u5de5\u4f5c</strong> \u2014\u2014 \u5728\u60a8\u7684\u673a\u5668\u4e0a\u672c\u5730\u8fd0\u884c\u6a21\u578b\uff0c\u5b8c\u5168\u4fdd\u5bc6',
      'planner-eyebrow':   '\u53ef\u89c6\u5316\u89c4\u5212',
      'planner-title':     '\u89c4\u5212\u6bcf\u4e00\u4e2a<br><em>\u8282\u62cd</em>',
      'planner-desc':      '\u53ef\u89c6\u5316\u5730\u7ed8\u5236\u60a8\u7684\u6545\u4e8b\u3002\u5c06\u7ae0\u8282\u3001\u573a\u666f\u548c\u8282\u62cd\u62d6\u62fd\u5230\u65e0\u9650\u753b\u5e03\u4e0a\u3002\u5728\u60a8\u5199\u4e0b\u7b2c\u4e00\u4e2a\u5b57\u4e4b\u524d\u5c31\u80fd\u770b\u5230\u60a8\u53d9\u4e8b\u7684\u5f62\u6001\u3002',
      'planner-list-1':    '<strong>\u53ef\u89c6\u5316\u8282\u70b9\u56fe</strong> \u2014\u2014 \u7ae0\u8282\u3001\u573a\u666f\u3001\u8282\u62cd\u3001\u7b14\u8bb0',
      'planner-list-2':    '<strong>AI \u81ea\u52a8\u5e03\u5c40</strong> \u2014\u2014 \u57fa\u4e8e dagre \u7684\u56fe\u7f51\u7edc\u7ec4\u7ec7',
      'planner-list-3':    '<strong>\u8fde\u63a5\u7c7b\u578b</strong> \u2014\u2014 \u540e\u7eed\u3001\u56e0\u679c\u3001\u51b2\u7a81\u3001\u89e3\u51b3',
      'planner-list-4':    '<strong>\u8fde\u63a5 AI</strong> \u2014\u2014 \u4ece\u60a8\u7684\u89c4\u5212\u4e2d\u751f\u6210\u6545\u4e8b\u5185\u5bb9',
      'import-eyebrow':    '\u5bfc\u5165\u4e0e\u5bfc\u51fa',
      'import-title':      '\u5e26\u6765\u60a8\u7684<br><em>\u624b\u7a3f</em>',
      'import-desc':       '\u6295\u5165\u8349\u7a3f\uff0c\u89c2\u770b AI \u6784\u5efa\u60a8\u7684\u4e16\u754c\u3002\u5b83\u4f1a\u81ea\u52a8\u68c0\u6d4b\u89d2\u8272\u3001\u4e8b\u4ef6\u3001\u5173\u7cfb\u548c\u7ae0\u8282 \u2014\u2014 \u60a8\u7684\u6545\u4e8b\u7acb\u5373\u5c31\u7eea\u3002\u5b8c\u6210\u540e\uff0c\u53ef\u4ee5\u5bfc\u51fa\u6d01\u51c0\u7684\u624b\u7a3f\uff0c\u4f9b\u60a8\u7684\u7f16\u8f91\u6216\u8bd5\u8bfb\u8005\u4f7f\u7528\u3002',
      'import-list-1':     '<strong>\u591a\u683c\u5f0f</strong> \u2014\u2014 PDF, DOCX, ODT, TXT',
      'import-list-2':     '<strong>\u5b9e\u4f53\u63d0\u53d6</strong> \u2014\u2014 \u89d2\u8272\u3001\u4e8b\u4ef6\u3001\u5173\u7cfb\u548c\u7ae0\u8282',
      'import-list-3':     '<strong>\u624b\u7a3f\u5bfc\u51fa</strong>\uff0c\u652f\u6301\u81ea\u5b9a\u4e49\u9875\u9762\u5927\u5c0f\u3001\u8fb9\u8ddd\u548c\u5b57\u4f53',
      'import-list-4':     '<strong>\u975e\u7834\u574f\u6027</strong> \u2014\u2014 \u60a8\u7684\u539f\u59cb\u6587\u4ef6\u4fdd\u6301\u4e0d\u53d8',
      'dash-eyebrow':      '\u5206\u6790',
      'dash-title':        '\u8ddf\u8e2a\u60a8\u7684<br><em>AI \u4f7f\u7528\u60c5\u51b5</em>',
      'dash-desc':         '\u7cbe\u786e\u67e5\u770b\u60a8\u7684 AI \u5199\u4f5c\u4f1a\u8bdd\u5982\u4f55\u7d2f\u79ef\u3002\u76d1\u63a7 token\u3001\u6210\u672c\u548c\u6548\u7387\uff0c\u6a2a\u8de8\u4e0d\u540c\u63d0\u4f9b\u5546\u548c\u6a21\u578b \u2014\u2014 \u8ba9\u60a8\u80fd\u4f18\u5316\u5de5\u4f5c\u6d41\u7a0b\u3002',
      'dash-list-1':       '<strong>\u5b9e\u65f6\u8ddf\u8e2a</strong> \u2014\u2014 \u5728\u60a8\u5199\u4f5c\u65f6\u67e5\u770b token \u4f7f\u7528\u60c5\u51b5',
      'dash-list-2':       '<strong>\u6bcf\u6b21\u4f1a\u8bdd\u8be6\u60c5</strong> \u2014\u2014 \u6bd4\u8f83\u4e0d\u540c\u4f1a\u8bdd\u7684\u4f7f\u7528\u60c5\u51b5',
      'dash-list-3':       '<strong>\u6a21\u578b\u5bf9\u6bd4</strong> \u2014\u2014 \u67e5\u770b\u60a8\u6700\u5e38\u4f7f\u7528\u54ea\u4e9b\u63d0\u4f9b\u5546',
      'dash-list-4':       '<strong>\u53ef\u89c6\u5316\u4eea\u8868\u76d8</strong> \u2014\u2014 \u56fe\u8868\u3001\u5173\u952e\u6307\u6807\u548c\u6458\u8981',
      'stack-eyebrow':     '\u4e3a\u4f5c\u5bb6\u800c\u751f\uff0c\u7ecf\u4e45\u8010\u7528',
      'stack-title':       '\u60a8\u7684\u6545\u4e8b\uff0c\u59cb\u7ec8\u53ef\u7528\u3002<br><em>\u65e0\u9700\u8d26\u6237\u3002\u65e0\u9700\u8ba2\u9605\u3002</em>',
      'stack-card-1-title':'\u60a8\u7684\u6570\u636e\u4ecd\u5c5e\u4e8e\u60a8',
      'stack-card-1-desc': '\u65e0\u8fdc\u7a0b\u6570\u636e\u6536\u96c6\u3001\u65e0\u8d26\u6237\u3001\u65e0\u6570\u636e\u79bb\u5f00\u60a8\u7684\u673a\u5668\u3002\u8fde\u63a5\u60a8\u81ea\u5df1\u672c\u5730\u6258\u7ba1\u7684\u6a21\u578b\uff0c\u4fdd\u6301\u4e00\u5207\u79c1\u5bc6\u3002',
      'stack-card-2-title':'\u6b22\u8fce\u4f7f\u7528\u4e91\u63d0\u4f9b\u5546',
      'stack-card-2-desc': '\u66f4\u559c\u6b22\u4e91\u7aef AI\uff1f\u5728\u79d2\u7ea7\u5185\u8fde\u63a5 OpenAI\u3001Google \u6216\u5176\u4ed6\u63d0\u4f9b\u5546\u3002\u968f\u65f6\u66f4\u6362\u63d0\u4f9b\u5546\uff0c\u4e0d\u5f71\u54cd\u60a8\u7684\u5de5\u4f5c\u6d41\u7a0b\u3002',
      'stack-card-3-title':'\u5851\u9020 AI \u7684\u58f0\u97f3',
      'stack-card-3-desc': '\u5b9a\u4e49\u81ea\u5b9a\u4e49\u4eba\u8bbe\u548c\u5199\u4f5c\u6307\u4ee4\uff0c\u5851\u9020 AI \u5982\u4f55\u601d\u8003\u3001\u5199\u4f5c\u548c\u5efa\u8bae\uff0c\u9002\u914d\u60a8\u7684\u7279\u5b9a\u9879\u76ee\u548c\u4f5c\u54c1\u7c7b\u578b\u3002',
      'stack-card-4-title':'\u514d\u8d39\u3002\u5f00\u6e90\u3002\u6c38\u8fdc\u3002',
      'stack-card-4-desc': '\u65e0\u8d26\u6237\u3001\u65e0\u8ba2\u9605\u3001\u65e0\u5e9f\u8bdd\u3002\u68c0\u67e5\u4ee3\u7801\u3001\u8d21\u732e\u529f\u80fd\u3001\u6839\u636e\u9700\u6c42\u5206\u5c90\u3002\u59cb\u7ec8\u514d\u8d39\u3002',
      'cta-eyebrow':       '\u60a8\u7684\u6545\u4e8b\u4ece\u8fd9\u91cc\u5f00\u59cb',
      'cta-title':         '\u5f00\u59cb\u5199\u4f5c\u3002',
      'cta-desc':          '\u514d\u8d39\u4e0b\u8f7d Hallucinated Talles\u3002\u79bb\u7ebf\u5199\u4f5c\uff0c\u4f7f\u7528\u60a8\u60f3\u8981\u7684\u4efb\u4f55 AI\uff0c\u5c06\u60a8\u7684\u5de5\u4f5c\u4fdd\u5b58\u5728\u60a8\u7684\u673a\u5668\u4e0a \u2014\u2014 \u5b83\u5c5e\u4e8e\u7684\u5730\u65b9\u3002',
      'cta-download-btn':  '\u514d\u8d39\u4e0b\u8f7d',
      'cta-star-btn':      '\u5728 GitHub \u4e0a\u70b9\u661f',
      'cta-note':          'Windows &middot; macOS &middot; Linux &middot; \u59cb\u7ec8\u514d\u8d39',
      'footer-brand':      'Hallucinated Talles',
      'footer-link-github':'GitHub',
      'footer-link-releases':'\u53d1\u5e03\u7248\u672c',
      'footer-link-bug':   '\u62a5\u544a Bug',
      'footer-link-license':'\u8bb8\u53ef\u8bc1',
      'footer-copy':       '&copy; 2026 Hallucinated Talles &middot; \u514d\u8d39\u4e0e\u5f00\u6e90',
    },
  };

  // -----------------------------------------------------------------------
  // i18n: apply language and persist selection
  // -----------------------------------------------------------------------
  function setLanguage(lang) {
    const t = translations[lang];
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = t[key];
      if (text === undefined) return;
      if (el.tagName === 'TITLE') {
        document.title = text.replace(/<[^>]*>/g, '');
      } else {
        el.innerHTML = text;
      }
    });

    document.documentElement.setAttribute('lang', lang);
    var sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
    try { localStorage.setItem('lang', lang); } catch (e) { /* noop */ }
  }

  function initLanguage() {
    var lang = 'en';
    try {
      var stored = localStorage.getItem('lang');
      if (stored && translations[stored]) lang = stored;
    } catch (e) { /* noop */ }

    var sel = document.getElementById('lang-select');
    if (sel) {
      sel.addEventListener('change', function () {
        setLanguage(this.value);
      });
    }

    setLanguage(lang);
  }

  // Respect reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -----------------------------------------------------------------------
  // Hero staggered entrance
  // -----------------------------------------------------------------------
  function initHeroAnimations() {
    const heroElements = document.querySelectorAll('.hero .anim-fade-up');

    heroElements.forEach((el) => {
      const delay = parseInt(el.dataset.delay || '0', 10);

      if (prefersReducedMotion) {
        el.classList.add('visible');
        return;
      }

      setTimeout(() => {
        el.classList.add('visible');
      }, 300 + delay * 180); // stagger each by 180ms, start after 300ms
    });
  }

  // -----------------------------------------------------------------------
  // Scroll-triggered reveals
  // -----------------------------------------------------------------------
  function initScrollReveals() {
    const revealElements = document.querySelectorAll('.anim-reveal');

    if (prefersReducedMotion) {
      revealElements.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  // -----------------------------------------------------------------------
  // Feature card stagger (within viewport batch)
  // -----------------------------------------------------------------------
  function initFeatureCardStagger() {
    const cards = document.querySelectorAll('.feature-card');

    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const idxA = Array.from(cards).indexOf(a.target);
            const idxB = Array.from(cards).indexOf(b.target);
            return idxA - idxB;
          });

        visible.forEach((entry, i) => {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, i * 120);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    cards.forEach((card) => observer.observe(card));
  }

  // -----------------------------------------------------------------------
  // Typewriter effect for the cursor line in hero window
  // -----------------------------------------------------------------------
  function initTypewriter() {
    const cursor = document.querySelector('.app-cursor');
    if (!cursor || prefersReducedMotion) return;

    const phrases = [
      'But tonight, a light flickered in the tower \u2014',
      'And the sea began to remember.',
      'She opened the letter with trembling hands.',
    ];

    let phraseIndex = 0;
    const lineEl = cursor.closest('.app-editor-line');
    if (!lineEl) return;

    function typePhrase() {
      const phrase = phrases[phraseIndex];
      let charIndex = 0;

      lineEl.innerHTML = '';

      const textNode = document.createTextNode('');
      lineEl.appendChild(textNode);
      lineEl.appendChild(cursor.cloneNode(true));

      function typeChar() {
        if (charIndex < phrase.length) {
          textNode.textContent += phrase[charIndex];
          charIndex++;
          setTimeout(typeChar, 40 + Math.random() * 30);
        } else {
          // Pause, then next phrase
          setTimeout(() => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typePhrase();
          }, 3000);
        }
      }

      typeChar();
    }

    // Start after hero animation completes
    setTimeout(typePhrase, 2500);
  }

  // -----------------------------------------------------------------------
  // Nav background on scroll
  // -----------------------------------------------------------------------
  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 80) {
            nav.style.background = 'rgba(15, 14, 12, 0.92)';
            nav.style.backdropFilter = 'blur(12px)';
            nav.style.webkitBackdropFilter = 'blur(12px)';
          } else {
            nav.style.background = 'linear-gradient(to bottom, var(--bg) 60%, transparent)';
            nav.style.backdropFilter = 'none';
            nav.style.webkitBackdropFilter = 'none';
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Smooth anchor scrolling (fallback for older browsers)
  // -----------------------------------------------------------------------
  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    initLanguage();
    initHeroAnimations();
    initScrollReveals();
    initFeatureCardStagger();
    initTypewriter();
    initNavScroll();
    initSmoothAnchors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
