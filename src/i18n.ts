import type { Language } from './types';

const translations = {
  // Tabs
  tabPlanner:       { JP: '軽減プランナー',    EN: 'Mitigation Planner', DE: 'Schadensreduktion',    FR: 'Planif. mitigation',  KO: '감소 플래너',     CN: '减伤规划器' },
  tabSkills:        { JP: 'スキル参照',        EN: 'Skill Reference',    DE: 'Fähigkeitsreferenz',   FR: 'Référence compétences', KO: '스킬 참조',     CN: '技能参考' },

  // Grid column headers
  colTime:          { JP: '時間',             EN: 'Time',               DE: 'Zeit',                 FR: 'Temps',               KO: '시간',           CN: '时间' },
  colAction:        { JP: 'アクション',        EN: 'Action',             DE: 'Aktion',               FR: 'Action',              KO: '액션',           CN: '行动' },
  colType:          { JP: 'タイプ',           EN: 'Type',               DE: 'Typ',                  FR: 'Type',                KO: '유형',           CN: '类型' },
  colDamage:        { JP: 'ダメージ',          EN: 'Damage',             DE: 'Schaden',              FR: 'Dégâts',              KO: '데미지',          CN: '伤害' },
  colMitPct:        { JP: '軽減%',            EN: 'Mit%',               DE: 'Red.%',                FR: 'Miti.%',              KO: '경감%',           CN: '减伤%' },
  colMitigated:     { JP: '軽減後',           EN: 'Mitigated',          DE: 'Reduziert',            FR: 'Mitigé',              KO: '경감 후',         CN: '减伤后' },
  colBarrier:       { JP: 'バリア',           EN: 'Barrier',            DE: 'Barriere',             FR: 'Barrière',            KO: '배리어',          CN: '护盾' },

  // Role names
  roleT:            { JP: 'タンク',           EN: 'Tank',               DE: 'Tank',                 FR: 'Tank',                KO: '탱크',           CN: '坦克' },
  roleH:            { JP: 'ヒーラー',         EN: 'Healer',             DE: 'Heiler',               FR: 'Soigneur',            KO: '힐러',           CN: '治疗' },
  roleM:            { JP: '近接',             EN: 'Melee',              DE: 'Nahkampf',             FR: 'Corps-à-corps',       KO: '근접',           CN: '近战' },
  roleR:            { JP: '遠隔',             EN: 'Ranged',             DE: 'Fernkampf',            FR: 'Distance',            KO: '원거리',          CN: '远程' },
  roleC:            { JP: '魔法',             EN: 'Caster',             DE: 'Magier',               FR: 'Mage',                KO: '캐스터',          CN: '法系' },

  // Header controls
  labelLanguage:    { JP: '言語',             EN: 'Language',           DE: 'Sprache',              FR: 'Langue',              KO: '언어',           CN: '语言' },
  labelPartyHP:     { JP: 'PTの最大HP',       EN: 'Party HP',           DE: 'Gruppen-HP',           FR: 'PV du groupe',        KO: '파티 HP',        CN: '队伍HP' },
  labelTankHP:      { JP: 'タンクHP',         EN: 'Tank HP',            DE: 'Tank-HP',              FR: 'PV du tank',          KO: '탱크 HP',        CN: '坦克HP' },
  labelEncLevel:    { JP: 'コンテンツLv',     EN: 'Encounter Level',    DE: 'Begegnungslevel',      FR: 'Niveau contenu',      KO: '콘텐츠 레벨',     CN: '副本等级' },

  // Toolbar
  btnAddAction:     { JP: '+ アクション追加', EN: '+ Add Action',       DE: '+ Aktion hinzufügen',  FR: '+ Ajouter action',    KO: '+ 행동 추가',     CN: '+ 添加行动' },
  btnClear:         { JP: 'クリア…',          EN: 'Clear…',             DE: 'Löschen…',             FR: 'Effacer…',            KO: '지우기…',         CN: '清除…' },

  // Sync controls
  btnShare:         { JP: 'シェア',           EN: 'Share',              DE: 'Teilen',               FR: 'Partager',            KO: '공유',           CN: '分享' },
  btnJoin:          { JP: '参加',             EN: 'Join',               DE: 'Beitreten',            FR: 'Rejoindre',           KO: '참가',           CN: '加入' },
  btnCopyLink:      { JP: 'リンクをコピー',   EN: 'Copy link',          DE: 'Link kopieren',        FR: 'Copier le lien',      KO: '링크 복사',       CN: '复制链接' },
  btnCopied:        { JP: '✓ コピー済',       EN: '✓ Copied',           DE: '✓ Kopiert',            FR: '✓ Copié',             KO: '✓ 복사됨',        CN: '✓ 已复制' },
  btnRegen:         { JP: '↺ セッション更新', EN: '↺ Refresh Session',  DE: '↺ Sitzung erneuern',   FR: '↺ Renouveler session', KO: '↺ 세션 갱신',    CN: '↺ 刷新会话' },
  joinPlaceholder:  { JP: 'コード (例: X4K9MQ)', EN: 'Code (e.g. X4K9MQ)', DE: 'Code (z.B. X4K9MQ)', FR: 'Code (ex. X4K9MQ)', KO: '코드 (예: X4K9MQ)', CN: '代码 (如: X4K9MQ)' },

  // Plan tab bar
  btnNewPlan:       { JP: '+ 新しいプラン',   EN: '+ New plan',         DE: '+ Neuer Plan',         FR: '+ Nouveau plan',      KO: '+ 새 플랜',       CN: '+ 新计划' },

  // Phase controls
  btnAddPhase:      { JP: '+ フェーズ追加',   EN: '+ Add Phase',        DE: '+ Phase hinzufügen',   FR: '+ Ajouter phase',     KO: '+ 페이즈 추가',   CN: '+ 添加阶段' },
  btnNoPhase:       { JP: 'フェーズなし',     EN: 'No phases visible',  DE: 'Keine Phase sichtbar', FR: 'Aucune phase visible', KO: '표시된 페이즈 없음', CN: '没有可见阶段' },

  // Skill database
  skillDbTitle:     { JP: 'スキル参照',        EN: 'Skill Reference',   DE: 'Fähigkeitsreferenz',   FR: 'Référence compétences', KO: '스킬 참조',     CN: '技能参考' },
  skillSearch:      { JP: 'スキルを検索…',    EN: 'Search skills…',     DE: 'Skills suchen…',       FR: 'Rechercher compétences…', KO: '스킬 검색…',   CN: '搜索技能…' },
  skillAllJobs:     { JP: '全ジョブ',         EN: 'All Jobs',           DE: 'Alle Jobs',            FR: 'Tous les métiers',    KO: '모든 직업',       CN: '所有职业' },
  skillColIcon:     { JP: 'アイコン',         EN: 'Icon',               DE: 'Symbol',               FR: 'Icône',               KO: '아이콘',          CN: '图标' },
  skillColJob:      { JP: 'ジョブ',           EN: 'Job',                DE: 'Job',                  FR: 'Métier',              KO: '직업',           CN: '职业' },
  skillColSkill:    { JP: 'スキル',           EN: 'Skill',              DE: 'Fähigkeit',            FR: 'Compétence',          KO: '스킬',           CN: '技能' },
  skillColRecast:   { JP: 'リキャスト',       EN: 'Recast',             DE: 'Abklingzeit',          FR: 'Recharge',            KO: '재사용 대기',      CN: '冷却' },
  skillColDuration: { JP: '持続時間',         EN: 'Duration',           DE: 'Dauer',                FR: 'Durée',               KO: '지속 시간',       CN: '持续时间' },
  skillColPhysMit:  { JP: '物理軽減',         EN: 'Phys. Mit',          DE: 'Phys. Red.',           FR: 'Réduc. phys.',        KO: '물리 경감',       CN: '物理减伤' },
  skillColMagMit:   { JP: '魔法軽減',         EN: 'Magic Mit',          DE: 'Mag. Red.',            FR: 'Réduc. mag.',         KO: '마법 경감',       CN: '魔法减伤' },
  skillColBarrier:  { JP: 'バリア',           EN: 'Barrier',            DE: 'Barriere',             FR: 'Barrière',            KO: '배리어',          CN: '护盾' },
  skillColHeal:     { JP: '回復',             EN: 'Heal',               DE: 'Heilung',              FR: 'Soin',                KO: '힐',             CN: '治疗量' },
  skillColNotes:    { JP: 'メモ',             EN: 'Notes',              DE: 'Hinweise',             FR: 'Notes',               KO: '메모',           CN: '备注' },

  // Clear modal
  clearTitle:       { JP: '⚠ 軽減設定をクリア', EN: '⚠ Clear Mitigations', DE: '⚠ Abschwächungen löschen', FR: '⚠ Effacer mitigations', KO: '⚠ 경감 지우기', CN: '⚠ 清除减伤' },
  clearWarning:     { JP: 'この操作は取り消せません。', EN: 'This cannot be undone.', DE: 'Dies kann nicht rückgängig gemacht werden.', FR: 'Cette action est irréversible.', KO: '이 작업은 취소할 수 없습니다.', CN: '此操作无法撤销。' },
  clearScopeChoose: { JP: '範囲を選択してください。', EN: 'Choose a scope.', DE: 'Bereich wählen.', FR: 'Choisir une portée.', KO: '범위를 선택하세요.', CN: '选择范围。' },
  clearPhaseLabel:  { JP: 'このフェーズ',     EN: 'This phase',         DE: 'Dieser Abschnitt',     FR: 'Cette phase',         KO: '이 페이즈',       CN: '当前阶段' },
  clearPlanLabel:   { JP: 'このエンカウンター', EN: 'This encounter',   DE: 'Dieser Kampf',         FR: 'Cette rencontre',     KO: '이 공략',         CN: '当前副本' },
  clearAllLabel:    { JP: '全エンカウンター', EN: 'All encounters',     DE: 'Alle Kämpfe',          FR: 'Toutes les rencontres', KO: '모든 공략',      CN: '所有副本' },
  clearAllDesc:     { JP: '全てのプラン',     EN: 'every plan',         DE: 'alle Pläne',           FR: 'tous les plans',      KO: '모든 플랜',       CN: '所有计划' },
  clearActionsLabel:{ JP: 'アクションをクリア', EN: 'Clear Actions',     DE: 'Aktionen löschen',     FR: 'Effacer les actions', KO: '행동 지우기',      CN: '清除行动' },
  clearActionsDesc: { JP: '名前編集・追加アクション', EN: 'Custom edits & added actions', DE: 'Benutzerdefinierte Bearbeitungen & Aktionen', FR: 'Éditions perso. & actions ajoutées', KO: '커스텀 편집 및 추가 행동', CN: '自定义编辑和添加的行动' },
  clearActionsPrompt: { JP: '確認のためエンカウンター名を入力:', EN: 'Type the encounter name to confirm:', DE: 'Kampfnamen zur Bestätigung eingeben:', FR: 'Saisissez le nom de la rencontre pour confirmer :', KO: '확인을 위해 공략 이름을 입력하세요:', CN: '请输入副本名称以确认:' },
  clearActionsConfirm: { JP: '削除する',      EN: 'Delete',             DE: 'Löschen',              FR: 'Supprimer',           KO: '삭제',           CN: '删除' },
  clearActionsBack: { JP: '← 戻る',          EN: '← Back',             DE: '← Zurück',             FR: '← Retour',            KO: '← 뒤로',          CN: '← 返回' },

  // Close plan modal
  closePlanTitle:   { JP: '⚠ プランを閉じますか?', EN: '⚠ Close Plan?',      DE: '⚠ Plan schließen?',    FR: '⚠ Fermer le plan ?',  KO: '⚠ 플랜 닫기?',    CN: '⚠ 关闭计划?' },
  closePlanWarning: { JP: 'プランを閉じると完全に削除されます。この操作は取り消せません。', EN: 'Closing a plan permanently deletes it. This cannot be undone.', DE: 'Das Schließen eines Plans löscht ihn dauerhaft. Dies kann nicht rückgängig gemacht werden.', FR: 'Fermer un plan le supprime définitivement. Cette action est irréversible.', KO: '플랜을 닫으면 영구적으로 삭제됩니다. 이 작업은 취소할 수 없습니다.', CN: '关闭计划将永久删除它，此操作无法撤销。' },
  closePlanPrompt:  { JP: '確認のためプラン名を入力:', EN: 'Type the plan name to confirm:', DE: 'Plannamen zur Bestätigung eingeben:', FR: 'Saisissez le nom du plan pour confirmer :', KO: '확인을 위해 플랜 이름을 입력하세요:', CN: '请输入计划名称以确认:' },
  closePlanConfirm: { JP: 'プランを閉じる',   EN: 'Close Plan',         DE: 'Plan schließen',       FR: 'Fermer le plan',      KO: '플랜 닫기',        CN: '关闭计划' },

  // Regen modal
  regenTitle:       { JP: '⚠ セッション更新?', EN: '⚠ Refresh Session?', DE: '⚠ Sitzung erneuern?', FR: '⚠ Renouveler session ?', KO: '⚠ 세션 갱신?',  CN: '⚠ 刷新会话?' },
  regenDesc:        { JP: '新しいセッションコードが生成されます。', EN: 'This generates a new session code.', DE: 'Ein neuer Sitzungscode wird erstellt.', FR: 'Un nouveau code de session sera généré.', KO: '새로운 세션 코드가 생성됩니다.', CN: '这将生成一个新的会话代码。' },
  regenWarn:        { JP: 'グループに新しいコードを共有してください。', EN: 'Make sure to share the new code with your group.', DE: 'Teile den neuen Code mit deiner Gruppe.', FR: 'Partagez le nouveau code avec votre groupe.', KO: '그룹에 새 코드를 공유하세요.', CN: '请确保与团队分享新代码。' },
  btnRefresh:       { JP: '更新',             EN: 'Refresh',            DE: 'Erneuern',             FR: 'Renouveler',          KO: '갱신',           CN: '刷新' },
  btnCancel:        { JP: 'キャンセル',        EN: 'Cancel',             DE: 'Abbrechen',            FR: 'Annuler',             KO: '취소',           CN: '取消' },

  // Edit Action Modal
  editActionTitle:  { JP: 'アクション編集',   EN: 'Edit Action',        DE: 'Aktion bearbeiten',    FR: 'Modifier l\'action',  KO: '행동 편집',       CN: '编辑行动' },
  editFieldName:    { JP: '名前',             EN: 'Name',               DE: 'Name',                 FR: 'Nom',                 KO: '이름',           CN: '名称' },
  editFieldTime:    { JP: '時間',             EN: 'Time',               DE: 'Zeit',                 FR: 'Temps',               KO: '시간',           CN: '时间' },
  editTimeHint:     { JP: '(M:SS.s, 例: -0:20.0)', EN: '(M:SS.s, e.g. -0:20.0)', DE: '(M:SS.s, z.B. -0:20.0)', FR: '(M:SS.s, ex. -0:20.0)', KO: '(M:SS.s, 예: -0:20.0)', CN: '(M:SS.s, 如: -0:20.0)' },
  editTimeError:    { JP: '無効な形式 — M:SS.s で入力', EN: 'Invalid format — use M:SS.s', DE: 'Ungültig — M:SS.s verwenden', FR: 'Format invalide — utiliser M:SS.s', KO: '잘못된 형식 — M:SS.s 사용', CN: '格式无效 — 请使用 M:SS.s' },
  editFieldDmgType: { JP: 'ダメージタイプ',   EN: 'Damage Type',        DE: 'Schadenstyp',          FR: 'Type de dégâts',      KO: '데미지 유형',      CN: '伤害类型' },
  editFieldDmg:     { JP: 'ダメージ (軽減前)', EN: 'Damage (pre-mit)',   DE: 'Schaden (vor Reduz.)', FR: 'Dégâts (avant miti.)', KO: '데미지 (경감 전)', CN: '伤害 (减伤前)' },
  editDmgNone:      { JP: 'なし',             EN: 'None',               DE: 'Keiner',               FR: 'Aucun',               KO: '없음',           CN: '无' },
  editBtnReset:     { JP: 'デフォルトに戻す', EN: 'Reset to default',   DE: 'Zurücksetzen',         FR: 'Réinitialiser',       KO: '기본값으로 초기화', CN: '重置为默认' },
  editBtnSave:      { JP: '保存',             EN: 'Save',               DE: 'Speichern',            FR: 'Enregistrer',         KO: '저장',           CN: '保存' },

  // Hidden rows
  hiddenRows:       { JP: '{n} 件非表示',     EN: '{n} hidden',         DE: '{n} ausgeblendet',     FR: '{n} masqué(s)',        KO: '{n}개 숨김',      CN: '{n} 个隐藏' },

  // Edit hints
  dblClickRename:   { JP: 'ダブルクリックで名前変更', EN: 'Double-click to rename', DE: 'Doppelklick zum Umbenennen', FR: 'Double-clic pour renommer', KO: '더블클릭으로 이름 변경', CN: '双击重命名' },
} satisfies Record<string, Record<Language, string>>;

type Key = keyof typeof translations;

export function t(key: Key, lang: Language): string {
  return translations[key][lang] ?? translations[key]['EN'];
}

export function tFmt(key: Key, lang: Language, vars: Record<string, string | number>): string {
  let str = t(key, lang);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v));
  }
  return str;
}
