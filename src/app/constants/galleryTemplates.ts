export type GalleryTemplate = {
  title: string;
  description: string;
  image: string;
  category: string;
};

export const GALLERY_TEMPLATES: GalleryTemplate[] = [
  {
    title: '空白展覽',
    description: '從空白場景開始，自由打造你的展覽空間。',
    image: '/templates/blank.svg',
    category: '未分類',
  },
  {
    title: '現代藝術畫廊',
    description: '極簡白色空間，適合當代藝術展示。',
    image: '/templates/cover-art.jpg',
    category: '藝術',
  },
  {
    title: '科技展示廳',
    description: '未來感十足的產品展示空間。',
    image: '/templates/cover-tech.jpg',
    category: '商業',
  },
  {
    title: '歷史博物館',
    description: '經典莊重的文物展示環境。',
    image: '/templates/cover-history.jpg',
    category: '文化',
  },
  {
    title: '時尚展示間',
    description: '精緻優雅的品牌展示空間。',
    image: '/templates/cover-fashion.jpg',
    category: '時尚',
  },
  {
    title: '攝影作品展',
    description: '專業燈光配置的攝影展覽廳。',
    image: '/templates/cover-photo.jpg',
    category: '藝術',
  },
  {
    title: '汽車展示廳',
    description: '寬敞明亮的車輛展示空間。',
    image: '/templates/cover-car.jpg',
    category: '商業',
  },
];

export const CREATE_GALLERY_TEMPLATE_TITLES = GALLERY_TEMPLATES.map((template) => template.title);
