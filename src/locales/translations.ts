export type Language = 'en' | 'es' | 'pt';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Home Screen
    'home.title': 'QC Checklist',
    'home.manager_mode': 'Management Mode',
    'home.inspector_mode': 'Construction Site Inspector',
    'home.new_project': 'New Project',
    'home.serious_events': 'serious event',
    'home.search_placeholder': 'Search projects...',
    'home.projects': 'Projects',
    'home.templates': 'Templates',
    'home.checklists': 'Checklists',
    'home.no_projects': 'No projects yet. Create one to get started.',
    'home.no_templates': 'No templates yet. Create one to start inspections.',
    'home.start_inspection': 'Start Inspection',
    'home.all': 'All',
    'home.active': 'Active',
    'home.completed': 'Completed',

    // Inspection Screen
    'inspection.items': 'Items',
    'inspection.pass': 'Pass',
    'inspection.fail': 'Fail',
    'inspection.na': 'N/A',
    'inspection.severity': 'Severity',
    'inspection.low': 'Low',
    'inspection.medium': 'Medium',
    'inspection.high': 'High',
    'inspection.serious_event': '⚠ Serious event — management has been notified',
    'inspection.comments': 'Add comments or discrepancies...',
    'inspection.camera': 'Camera',
    'inspection.gallery': 'Gallery',
    'inspection.remove': 'Remove',
    'inspection.uploaded': 'Uploaded',
    'inspection.pending_upload': 'Pending upload',
    'inspection.sign_off': 'Sign Off & Complete',
    'inspection.punch_list': 'Punch List',

    // Punch List
    'punch.title': 'New Punch Item',
    'punch.description_placeholder': 'Describe the task...',
    'punch.add': 'Add Item',
    'punch.no_items': 'No punch items yet. Add one to track tasks.',

    // Alerts
    'alerts.title': 'Management Alerts',
    'alerts.no_alerts': 'No alerts. All systems normal.',

    // Activity Log
    'activity.title': 'Team Activity',
    'activity.completed': 'Completed Checklist',
    'activity.severity_flagged': 'Flagged Issue',
    'activity.punch_closed': 'Closed Punch Item',
    'activity.note_added': 'Added Note',
    'activity.by': 'by',
    'activity.no_activities': 'No activities yet. Start inspections to see team updates.',

    // Errors
    'error.loading': 'Failed to load',
    'error.saving': 'Failed to save',
    'error.syncing': 'Sync failed',
    'error.required': 'This field is required',

    // Success
    'success.saved': 'Saved successfully',
    'success.synced': 'Sync complete',
    'success.photo_added': 'Photo attached',
    'success.item_added': 'Punch item added',
    'success.signed_off': 'Checklist signed off and completed',
  },

  es: {
    // Home Screen
    'home.title': 'Lista de Verificación QC',
    'home.manager_mode': 'Modo Gerencia',
    'home.inspector_mode': 'Inspector del Sitio de Construcción',
    'home.new_project': 'Nuevo Proyecto',
    'home.serious_events': 'evento grave',
    'home.search_placeholder': 'Buscar proyectos...',
    'home.projects': 'Proyectos',
    'home.templates': 'Plantillas',
    'home.checklists': 'Listas de Verificación',
    'home.no_projects': 'Sin proyectos aún. Crea uno para empezar.',
    'home.no_templates': 'Sin plantillas aún. Crea una para comenzar inspecciones.',
    'home.start_inspection': 'Comenzar Inspección',
    'home.all': 'Todas',
    'home.active': 'Activas',
    'home.completed': 'Completadas',

    // Inspection Screen
    'inspection.items': 'Elementos',
    'inspection.pass': 'Aprobado',
    'inspection.fail': 'Rechazado',
    'inspection.na': 'N/A',
    'inspection.severity': 'Severidad',
    'inspection.low': 'Baja',
    'inspection.medium': 'Media',
    'inspection.high': 'Alta',
    'inspection.serious_event': '⚠ Evento grave — la gerencia ha sido notificada',
    'inspection.comments': 'Agregar comentarios o discrepancias...',
    'inspection.camera': 'Cámara',
    'inspection.gallery': 'Galería',
    'inspection.remove': 'Eliminar',
    'inspection.uploaded': 'Cargado',
    'inspection.pending_upload': 'Pendiente de carga',
    'inspection.sign_off': 'Firmar y Completar',
    'inspection.punch_list': 'Lista de Pendientes',

    // Punch List
    'punch.title': 'Nuevo Pendiente',
    'punch.description_placeholder': 'Describe la tarea...',
    'punch.add': 'Agregar Elemento',
    'punch.no_items': 'Sin pendientes aún. Agrega uno para rastrear tareas.',

    // Alerts
    'alerts.title': 'Alertas de Gerencia',
    'alerts.no_alerts': 'Sin alertas. Todos los sistemas normales.',

    // Activity Log
    'activity.title': 'Actividad del Equipo',
    'activity.completed': 'Inspección Completada',
    'activity.severity_flagged': 'Problema Señalado',
    'activity.punch_closed': 'Pendiente Cerrado',
    'activity.note_added': 'Nota Agregada',
    'activity.by': 'por',
    'activity.no_activities': 'Sin actividades aún. Comienza inspecciones para ver actualizaciones del equipo.',

    // Errors
    'error.loading': 'Error al cargar',
    'error.saving': 'Error al guardar',
    'error.syncing': 'Falló la sincronización',
    'error.required': 'Este campo es obligatorio',

    // Success
    'success.saved': 'Guardado con éxito',
    'success.synced': 'Sincronización completada',
    'success.photo_added': 'Foto adjunta',
    'success.item_added': 'Elemento agregado',
    'success.signed_off': 'Inspección firmada y completada',
  },

  pt: {
    // Home Screen
    'home.title': 'Lista de Verificação QC',
    'home.manager_mode': 'Modo Gerência',
    'home.inspector_mode': 'Inspetor do Canteiro de Obras',
    'home.new_project': 'Novo Projeto',
    'home.serious_events': 'evento sério',
    'home.search_placeholder': 'Pesquisar projetos...',
    'home.projects': 'Projetos',
    'home.templates': 'Modelos',
    'home.checklists': 'Listas de Verificação',
    'home.no_projects': 'Nenhum projeto ainda. Crie um para começar.',
    'home.no_templates': 'Nenhum modelo ainda. Crie um para começar inspeções.',
    'home.start_inspection': 'Iniciar Inspeção',
    'home.all': 'Todas',
    'home.active': 'Ativas',
    'home.completed': 'Concluídas',

    // Inspection Screen
    'inspection.items': 'Itens',
    'inspection.pass': 'Aprovado',
    'inspection.fail': 'Reprovado',
    'inspection.na': 'N/A',
    'inspection.severity': 'Severidade',
    'inspection.low': 'Baixa',
    'inspection.medium': 'Média',
    'inspection.high': 'Alta',
    'inspection.serious_event': '⚠ Evento sério — a gerência foi notificada',
    'inspection.comments': 'Adicionar comentários ou discrepâncias...',
    'inspection.camera': 'Câmera',
    'inspection.gallery': 'Galeria',
    'inspection.remove': 'Remover',
    'inspection.uploaded': 'Enviado',
    'inspection.pending_upload': 'Pendente de envio',
    'inspection.sign_off': 'Assinar e Concluir',
    'inspection.punch_list': 'Lista de Pendências',

    // Punch List
    'punch.title': 'Novo Pendente',
    'punch.description_placeholder': 'Descrever a tarefa...',
    'punch.add': 'Adicionar Item',
    'punch.no_items': 'Nenhum pendente ainda. Adicione um para rastrear tarefas.',

    // Alerts
    'alerts.title': 'Alertas de Gerência',
    'alerts.no_alerts': 'Sem alertas. Todos os sistemas normais.',

    // Activity Log
    'activity.title': 'Atividade da Equipe',
    'activity.completed': 'Inspeção Concluída',
    'activity.severity_flagged': 'Problema Sinalizado',
    'activity.punch_closed': 'Pendente Fechado',
    'activity.note_added': 'Nota Adicionada',
    'activity.by': 'por',
    'activity.no_activities': 'Sem atividades ainda. Comece inspeções para ver atualizações da equipe.',

    // Errors
    'error.loading': 'Falha ao carregar',
    'error.saving': 'Falha ao salvar',
    'error.syncing': 'Falha na sincronização',
    'error.required': 'Este campo é obrigatório',

    // Success
    'success.saved': 'Salvo com sucesso',
    'success.synced': 'Sincronização concluída',
    'success.photo_added': 'Foto anexada',
    'success.item_added': 'Item adicionado',
    'success.signed_off': 'Inspeção assinada e concluída',
  },
};

export const t = (key: string, language: Language = 'en'): string => {
  return translations[language]?.[key] ?? key;
};
