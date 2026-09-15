// Department values must match backend/localization/departments.py (Department enum).
export const DEPARTMENTS = [
  { value: 'senior_management', labelEn: 'Senior Management', labelZh: '高层管理' },
  { value: 'general_office', labelEn: 'GM Office', labelZh: '总经办' },
  { value: 'xishan_home', labelEn: 'Shianco Home', labelZh: '锡山家居' },
  { value: 'kaka_time', labelEn: 'Kaka Time', labelZh: '咖咖时光' },
  { value: 'agio_business', labelEn: 'Agio Sales', labelZh: 'Agio 业务' },
  { value: 'agio_rd', labelEn: 'Agio R&D', labelZh: 'Agio 研发' },
  { value: 'production_dept', labelEn: 'Production Department', labelZh: '生产事业部' },
];

export const getDepartmentLabel = (value, language = 'EN') => {
  const dept = DEPARTMENTS.find((d) => d.value === value);
  if (!dept) return value || '';
  return language === 'CN' ? dept.labelZh : dept.labelEn;
};
