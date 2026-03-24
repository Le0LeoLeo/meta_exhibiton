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
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
    category: '未分類',
  },
  {
    title: '現代藝術畫廊',
    description: '極簡白色空間，適合當代藝術展示。',
    image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80',
    category: '藝術',
  },
  {
    title: '科技展示廳',
    description: '未來感十足的產品展示空間。',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
    category: '商業',
  },
  {
    title: '歷史博物館',
    description: '經典莊重的文物展示環境。',
    image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&q=80',
    category: '文化',
  },
  {
    title: '時尚展示間',
    description: '精緻優雅的品牌展示空間。',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
    category: '時尚',
  },
  {
    title: '攝影作品展',
    description: '專業燈光配置的攝影展覽廳。',
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80',
    category: '藝術',
  },
  {
    title: '汽車展示廳',
    description: '寬敞明亮的車輛展示空間。',
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80',
    category: '商業',
  },
];

export const CREATE_GALLERY_TEMPLATE_TITLES = ['空白展覽', '現代藝術畫廊', '科技展示廳', '歷史博物館'] as const;
