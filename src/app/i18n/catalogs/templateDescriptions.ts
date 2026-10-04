// Template descriptions live outside the per-locale catalogs because exhibitions store the
// description in their creator's language; every locale's text must stay recognisable even
// when only one catalog is loaded (see utils/templateDescription.ts).
export const templateDescriptions = {
  en: {
    vgTemplateBlankDesc: 'Start from an empty scene and build your exhibition freely.',
    vgTemplateModernArtDesc: "A white gallery for visual analysis and student art projects.",
    vgTemplateTechDesc: "Present prototypes, experiment images and explanations of your process.",
    vgTemplateMuseumDesc: "Exhibit source material and interpretations for a history inquiry.",
    vgTemplateFashionDesc: "Show sketches, design choices and revisions from a student project.",
    vgTemplatePhotoDesc: "Arrange photographs to explain a topic and discuss different interpretations.",
    vgTemplateCarDesc: "A spacious room for engineering models and explanations of how they work.",
  },
  'zh-TW': {
    vgTemplateBlankDesc: '從空白場景開始，自由打造你的展覽空間。',
    vgTemplateModernArtDesc: "用白色展廳展示學生藝術作品，練習觀察與分析。",
    vgTemplateTechDesc: "展示原型、實驗圖片與探究過程。",
    vgTemplateMuseumDesc: "展示歷史探究的資料來源與解讀。",
    vgTemplateFashionDesc: "展示學生專題的草圖、設計選擇與修改過程。",
    vgTemplatePhotoDesc: "以照片呈現學習主題，交流不同解讀。",
    vgTemplateCarDesc: "在寬敞空間展示工程模型並解釋運作原理。",
  },
  'zh-CN': {
    vgTemplateBlankDesc: '从空白场景开始，自由打造你的展览空间。',
    vgTemplateModernArtDesc: "用白色展厅展示学生艺术作品，练习观察与分析。",
    vgTemplateTechDesc: "展示原型、实验图片与探究过程。",
    vgTemplateMuseumDesc: "展示历史探究的资料来源与解读。",
    vgTemplateFashionDesc: "展示学生专题的草图、设计选择与修改过程。",
    vgTemplatePhotoDesc: "以照片呈现学习主题，交流不同解读。",
    vgTemplateCarDesc: "在宽敞空间展示工程模型并解释运作原理。",
  },
} as const;

export type TemplateDescriptionKey = keyof typeof templateDescriptions.en;
