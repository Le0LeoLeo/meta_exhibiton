import type { Locale } from '@/app/components/I18nProvider';
import type { ExhibitWorkContext } from '@/app/modules/metaverse3d/types';

/**
 * Built-in sample class exhibition. The students and teacher are fictional; the
 * artworks are public-domain images from The Met Open Access in public/demo
 * (see docs/demo-artwork-sources.md). scripts/seed-demo-class-exhibition.mjs
 * creates the same exhibition in a local database for multiplayer demos.
 */
export const classSampleArtworks = [
  { id: 45434, key: 101, width: 600, height: 403, date: 'ca. 1830–32' },
  { id: 436532, key: 102, width: 502, height: 625, date: '1887' },
  { id: 436535, key: 103, width: 599, height: 477, date: '1889' },
  { id: 56213, key: 104, width: 599, height: 394, date: 'ca. 1830–32' },
  { id: 55739, key: 105, width: 599, height: 421, date: '1832–33' },
  { id: 436530, key: 106, width: 599, height: 492, date: '1888' },
] as const;

export type ClassSampleComment = { name: string; text: string };
export type ClassSampleWork = { title: string; artist: string; description: string; workContext: ExhibitWorkContext; comments: ClassSampleComment[] };
export type ClassSampleCopy = { inquiryLabel: string; inquiry: string; note: string; commentsTitle: string; works: ClassSampleWork[] };

const met = (id: number) => `https://www.metmuseum.org/art/collection/search/${id}`;

const en: ClassSampleCopy = {
  inquiryLabel: 'Inquiry question',
  inquiry: 'How did Japanese woodblock prints change the way some European artists painted?',
  note: 'Sample exhibition: the students and teacher are fictional. Artworks are public-domain images from The Met Open Access.',
  commentsTitle: 'Classmates’ comments',
  works: [
    {
      title: 'Under the Wave off Kanagawa', artist: 'Katsushika Hokusai',
      description: 'Label by Ava. A woodblock print that many European artists saw in the late 1800s.',
      workContext: {
        contribution: 'I researched when prints like this reached Europe and wrote the label that starts our class story.',
        process: 'I compared the museum record with our textbook chapter and fixed my dates after Ben noticed I had written 1850 instead of about 1830–32.',
        outcome: 'A 100-word label and the first card on our class timeline.',
        reflection: 'I learned to write down where every date comes from, not just the date itself.',
        sources: [
          { label: 'The Met collection record', url: met(45434), excerpt: 'My notes: Katsushika Hokusai, about 1830–32, polychrome woodblock print.' },
          { label: 'Peer feedback from Ben', excerpt: 'Dates are clear now. Say which book the claim about Europe comes from.' },
        ],
      },
      comments: [
        { name: 'Ben', text: 'The timeline card really helped. Which book says prints like this reached Europe later in the 1800s?' },
        { name: 'Ava', text: 'Good point, it is our textbook chapter 6. I will add the page number to the source.' },
        { name: 'Ms Lee (teacher)', text: 'Try asking the AI guide what it can and cannot tell from your label alone, then compare that with your sources.' },
      ],
    },
    {
      title: 'Self-Portrait with a Straw Hat', artist: 'Vincent van Gogh',
      description: 'Label by Daniel. Painted in Paris, the year our class timeline links to Japanese prints.',
      workContext: {
        contribution: 'I wrote the label connecting Van Gogh’s time in Paris with the prints he collected there.',
        process: 'I listed what our textbook says about 1887 and kept only the points I could match to a source.',
        outcome: 'A label and two questions for visitors about the short, separate brushstrokes.',
        reflection: 'At first I wrote that the prints “caused” this style. I changed it to “may have influenced”, because my sources do not prove a direct cause.',
        sources: [
          { label: 'The Met collection record', url: met(436532), excerpt: 'My notes: Vincent van Gogh, 1887, oil on canvas.' },
          { label: 'Class textbook, chapter 6', excerpt: 'My notes: Van Gogh lived in Paris from 1886 to 1888 and collected Japanese prints.' },
        ],
      },
      comments: [{ name: 'Felix', text: '“May have influenced” is more careful than “caused”. Is there anything in the painting itself that looks like a print?' }],
    },
    {
      title: 'Wheat Field with Cypresses', artist: 'Vincent van Gogh',
      description: 'Label by Emma. Compares the curling lines of the sky with the wave print.',
      workContext: {
        contribution: 'I made the comparison between the swirling sky here and the curling wave in Hokusai’s print.',
        process: 'I traced the main curves of both images and showed the tracings to my group.',
        outcome: 'A comparison label marked clearly as my interpretation.',
        reflection: 'Two classmates did not see a link. Instead of removing the idea, I labelled it as my interpretation so visitors can judge for themselves.',
        sources: [
          { label: 'The Met collection record', url: met(436535), excerpt: 'My notes: Vincent van Gogh, 1889, oil on canvas.' },
          { label: 'Group discussion notes', excerpt: 'Two of four group members agreed the curves look similar; two thought the link was weak.' },
        ],
      },
      comments: [
        { name: 'Chloe', text: 'I still do not see a link to the wave, but marking it as your interpretation is fair.' },
        { name: 'Emma', text: 'Thanks! What would convince you? I could put my two tracings side by side.' },
      ],
    },
    {
      title: 'Fuji from the Katakura Tea Fields in Suruga', artist: 'Katsushika Hokusai',
      description: 'Label by Ben. Everyday work in front of Mount Fuji.',
      workContext: {
        contribution: 'I explained how the print layers tea pickers, fields and Mount Fuji to create depth.',
        process: 'I sketched the picture as three layers before writing, then tested the label by reading it aloud to Chloe.',
        outcome: 'A label and a three-layer sketch shown in class.',
        reflection: 'Drawing the layers helped me explain composition more clearly than words alone.',
        sources: [
          { label: 'The Met collection record', url: met(56213), excerpt: 'My notes: from the series Thirty-six Views of Mount Fuji, about 1830–32.' },
          { label: 'Teacher comment', excerpt: 'Good use of your sketch. Add one sentence on why everyday scenes mattered.' },
        ],
      },
      comments: [{ name: 'Daniel', text: 'The three-layer sketch made the depth easy to see. Could you hang the sketch next to the print?' }],
    },
    {
      title: 'Noboto at Shimōsa', artist: 'Katsushika Hokusai',
      description: 'Label by Chloe. People working by the sea.',
      workContext: {
        contribution: 'I compared how Hokusai shows people working by the sea in this print and in the wave print.',
        process: 'I made a two-column table of what each print shows and asked Ava to check it against her research.',
        outcome: 'A label and a comparison table.',
        reflection: 'My first draft only described the picture. Feedback pushed me to explain what the comparison tells us.',
        sources: [
          { label: 'The Met collection record', url: met(55739), excerpt: 'My notes: from the series One Thousand Pictures of the Sea, 1832–33.' },
          { label: 'Peer feedback from Ava', excerpt: 'Your table is clear. What is the point of comparing them?' },
        ],
      },
      comments: [],
    },
    {
      title: 'Oleanders', artist: 'Vincent van Gogh',
      description: 'Label by Felix. Bright, flat areas of colour.',
      workContext: {
        contribution: 'I wrote about the flat, bright areas of colour and asked whether they show influence from prints.',
        process: 'I looked for colour areas without shading and marked them on a printout.',
        outcome: 'A label ending with an open question for visitors.',
        reflection: 'Our class reading says Van Gogh compared the south of France to Japan in his letters, but I have not read those letters myself, so I left it as a question.',
        sources: [{ label: 'The Met collection record', url: met(436530), excerpt: 'My notes: Vincent van Gogh, 1888, oil on canvas.' }],
      },
      comments: [
        { name: 'Ava', text: 'Could we look for that letter in an online collection before the final version, so you can quote it yourself?' },
        { name: 'Felix', text: 'Yes, I will check and update the label if I find it.' },
      ],
    },
  ],
};

const zhTW: ClassSampleCopy = {
  inquiryLabel: '探究問題',
  inquiry: '日本木版畫如何改變了部分歐洲畫家的繪畫方式？',
  note: '示範展覽：學生和老師均為虛構人物。作品為大都會藝術博物館 Open Access 的公有領域圖像。',
  commentsTitle: '同學留言',
  works: [
    {
      title: '神奈川沖浪裏', artist: '葛飾北齋',
      description: 'Ava 撰寫的展品說明。這是一幅十九世紀後期許多歐洲畫家都見過的木版畫。',
      workContext: {
        contribution: '我研究了這類版畫何時傳到歐洲，並寫下作為全班故事開端的展品說明。',
        process: '我比對了博物館紀錄和課本章節；Ben 指出我把約 1830–32 年誤寫成 1850 年後，我更正了年份。',
        outcome: '一段約 100 字的展品說明，以及全班時間線上的第一張卡片。',
        reflection: '我學會記下每個年份的出處，而不只是寫下年份。',
        sources: [
          { label: '大都會藝術博物館館藏紀錄', url: met(45434), excerpt: '我的筆記：葛飾北齋，約 1830–32 年，多色木版畫。' },
          { label: 'Ben 的同儕回饋', excerpt: '年份清楚了。請說明「傳到歐洲」的說法出自哪本書。' },
        ],
      },
      comments: [
        { name: 'Ben', text: '時間線卡片很有幫助。哪本書說這類版畫在十九世紀後期傳到歐洲？' },
        { name: 'Ava', text: '問得好，是課本第 6 章。我會在來源加上頁碼。' },
        { name: 'Lee 老師', text: '試試問 AI 導覽：單憑你的說明它能判斷甚麼、不能判斷甚麼，再和你的來源比較。' },
      ],
    },
    {
      title: '戴草帽的自畫像', artist: '梵高',
      description: 'Daniel 撰寫的展品說明。這幅畫在巴黎完成，正是全班時間線連結到日本版畫的那一年。',
      workContext: {
        contribution: '我寫了展品說明，把梵高在巴黎的日子與他在當地收藏的版畫連結起來。',
        process: '我列出課本對 1887 年的描述，只保留能對應到來源的內容。',
        outcome: '一段展品說明，以及兩條關於短而分開的筆觸、給觀眾思考的問題。',
        reflection: '我起初寫版畫「導致」了這種風格，後來改成「可能影響了」，因為我的來源無法證明直接的因果關係。',
        sources: [
          { label: '大都會藝術博物館館藏紀錄', url: met(436532), excerpt: '我的筆記：梵高，1887 年，布面油畫。' },
          { label: '課本第 6 章', excerpt: '我的筆記：梵高在 1886 至 1888 年住在巴黎，並收藏日本版畫。' },
        ],
      },
      comments: [{ name: 'Felix', text: '「可能影響了」比「導致」更謹慎。畫作本身有沒有哪裡看起來像版畫？' }],
    },
    {
      title: '有柏樹的麥田', artist: '梵高',
      description: 'Emma 撰寫的展品說明。比較天空的捲曲線條和浪濤版畫。',
      workContext: {
        contribution: '我比較了這幅畫中旋轉的天空和北齋版畫中捲起的浪。',
        process: '我描出兩幅圖的主要曲線，再把描圖給組員看。',
        outcome: '一段清楚標明是「我的詮釋」的比較說明。',
        reflection: '有兩位同學看不出關聯。我沒有刪掉這個想法，而是標明它是我的詮釋，讓觀眾自行判斷。',
        sources: [
          { label: '大都會藝術博物館館藏紀錄', url: met(436535), excerpt: '我的筆記：梵高，1889 年，布面油畫。' },
          { label: '小組討論紀錄', excerpt: '四位組員中兩位同意曲線相似，兩位認為關聯不強。' },
        ],
      },
      comments: [
        { name: 'Chloe', text: '我還是看不出和浪濤的關聯，但標明是你的詮釋是公平的。' },
        { name: 'Emma', text: '謝謝！怎樣才能說服你？我可以把兩張描圖並排展示。' },
      ],
    },
    {
      title: '駿州片倉茶園之富士', artist: '葛飾北齋',
      description: 'Ben 撰寫的展品說明。富士山前的日常勞動。',
      workContext: {
        contribution: '我說明了這幅版畫如何以採茶人、茶園和富士山三層營造深度。',
        process: '寫作前我先把畫面畫成三層的草圖，寫好後讀給 Chloe 聽來測試說明。',
        outcome: '一段展品說明和一張在課堂展示的三層草圖。',
        reflection: '把層次畫出來，比單用文字更能清楚解釋構圖。',
        sources: [
          { label: '大都會藝術博物館館藏紀錄', url: met(56213), excerpt: '我的筆記：出自《富嶽三十六景》系列，約 1830–32 年。' },
          { label: '老師評語', excerpt: '草圖運用得很好。請加一句說明為何日常場景值得關注。' },
        ],
      },
      comments: [{ name: 'Daniel', text: '三層草圖讓深度一目了然。可以把草圖掛在版畫旁邊嗎？' }],
    },
    {
      title: '下總登戶', artist: '葛飾北齋',
      description: 'Chloe 撰寫的展品說明。海邊勞動的人們。',
      workContext: {
        contribution: '我比較了北齋在這幅和浪濤版畫中如何描繪海邊勞動的人。',
        process: '我做了一張兩欄表格列出兩幅版畫各自呈現的內容，並請 Ava 對照她的研究檢查。',
        outcome: '一段展品說明和一張比較表。',
        reflection: '我的初稿只描述了畫面。同學的回饋推動我說明這個比較告訴我們甚麼。',
        sources: [
          { label: '大都會藝術博物館館藏紀錄', url: met(55739), excerpt: '我的筆記：出自《千繪之海》系列，1832–33 年。' },
          { label: 'Ava 的同儕回饋', excerpt: '表格很清楚。比較它們的重點是甚麼？' },
        ],
      },
      comments: [],
    },
    {
      title: '夾竹桃', artist: '梵高',
      description: 'Felix 撰寫的展品說明。鮮明而平塗的色塊。',
      workContext: {
        contribution: '我寫了關於平塗鮮豔色塊的說明，並提出它們是否受版畫影響的問題。',
        process: '我找出沒有明暗變化的色塊，並在列印稿上標示出來。',
        outcome: '一段以開放問題作結、留給觀眾思考的展品說明。',
        reflection: '課堂讀物說梵高在書信中把法國南部比作日本，但我自己還沒讀過那些信，所以只把它寫成一個問題。',
        sources: [{ label: '大都會藝術博物館館藏紀錄', url: met(436530), excerpt: '我的筆記：梵高，1888 年，布面油畫。' }],
      },
      comments: [
        { name: 'Ava', text: '定稿前我們可以在網上館藏找找那封信嗎？這樣你就能自己引用。' },
        { name: 'Felix', text: '好，我會去查，找到就更新說明。' },
      ],
    },
  ],
};

const zhCN: ClassSampleCopy = {
  inquiryLabel: '探究问题',
  inquiry: '日本木版画如何改变了部分欧洲画家的绘画方式？',
  note: '示范展览：学生和老师均为虚构人物。作品为大都会艺术博物馆 Open Access 的公有领域图像。',
  commentsTitle: '同学留言',
  works: [
    {
      title: '神奈川冲浪里', artist: '葛饰北斋',
      description: 'Ava 撰写的展品说明。这是一幅十九世纪后期许多欧洲画家都见过的木版画。',
      workContext: {
        contribution: '我研究了这类版画何时传到欧洲，并写下作为全班故事开端的展品说明。',
        process: '我比对了博物馆记录和课本章节；Ben 指出我把约 1830–32 年误写成 1850 年后，我更正了年份。',
        outcome: '一段约 100 字的展品说明，以及全班时间线上的第一张卡片。',
        reflection: '我学会记下每个年份的出处，而不只是写下年份。',
        sources: [
          { label: '大都会艺术博物馆馆藏记录', url: met(45434), excerpt: '我的笔记：葛饰北斋，约 1830–32 年，多色木版画。' },
          { label: 'Ben 的同伴反馈', excerpt: '年份清楚了。请说明“传到欧洲”的说法出自哪本书。' },
        ],
      },
      comments: [
        { name: 'Ben', text: '时间线卡片很有帮助。哪本书说这类版画在十九世纪后期传到欧洲？' },
        { name: 'Ava', text: '问得好，是课本第 6 章。我会在来源加上页码。' },
        { name: 'Lee 老师', text: '试试问 AI 导览：单凭你的说明它能判断什么、不能判断什么，再和你的来源比较。' },
      ],
    },
    {
      title: '戴草帽的自画像', artist: '梵高',
      description: 'Daniel 撰写的展品说明。这幅画在巴黎完成，正是全班时间线联系到日本版画的那一年。',
      workContext: {
        contribution: '我写了展品说明，把梵高在巴黎的日子与他在当地收藏的版画联系起来。',
        process: '我列出课本对 1887 年的描述，只保留能对应到来源的内容。',
        outcome: '一段展品说明，以及两个关于短而分开的笔触、给观众思考的问题。',
        reflection: '我起初写版画“导致”了这种风格，后来改成“可能影响了”，因为我的来源无法证明直接的因果关系。',
        sources: [
          { label: '大都会艺术博物馆馆藏记录', url: met(436532), excerpt: '我的笔记：梵高，1887 年，布面油画。' },
          { label: '课本第 6 章', excerpt: '我的笔记：梵高在 1886 至 1888 年住在巴黎，并收藏日本版画。' },
        ],
      },
      comments: [{ name: 'Felix', text: '“可能影响了”比“导致”更谨慎。画作本身有没有哪里看起来像版画？' }],
    },
    {
      title: '有柏树的麦田', artist: '梵高',
      description: 'Emma 撰写的展品说明。比较天空的卷曲线条和浪涛版画。',
      workContext: {
        contribution: '我比较了这幅画中旋转的天空和北斋版画中卷起的浪。',
        process: '我描出两幅图的主要曲线，再把描图给组员看。',
        outcome: '一段清楚标明是“我的诠释”的比较说明。',
        reflection: '有两位同学看不出关联。我没有删掉这个想法，而是标明它是我的诠释，让观众自行判断。',
        sources: [
          { label: '大都会艺术博物馆馆藏记录', url: met(436535), excerpt: '我的笔记：梵高，1889 年，布面油画。' },
          { label: '小组讨论记录', excerpt: '四位组员中两位同意曲线相似，两位认为关联不强。' },
        ],
      },
      comments: [
        { name: 'Chloe', text: '我还是看不出和浪涛的关联，但标明是你的诠释是公平的。' },
        { name: 'Emma', text: '谢谢！怎样才能说服你？我可以把两张描图并排展示。' },
      ],
    },
    {
      title: '骏州片仓茶园之富士', artist: '葛饰北斋',
      description: 'Ben 撰写的展品说明。富士山前的日常劳动。',
      workContext: {
        contribution: '我说明了这幅版画如何以采茶人、茶园和富士山三层营造深度。',
        process: '写作前我先把画面画成三层的草图，写好后读给 Chloe 听来测试说明。',
        outcome: '一段展品说明和一张在课堂展示的三层草图。',
        reflection: '把层次画出来，比单用文字更能清楚解释构图。',
        sources: [
          { label: '大都会艺术博物馆馆藏记录', url: met(56213), excerpt: '我的笔记：出自《富岳三十六景》系列，约 1830–32 年。' },
          { label: '老师评语', excerpt: '草图运用得很好。请加一句说明为何日常场景值得关注。' },
        ],
      },
      comments: [{ name: 'Daniel', text: '三层草图让深度一目了然。可以把草图挂在版画旁边吗？' }],
    },
    {
      title: '下总登户', artist: '葛饰北斋',
      description: 'Chloe 撰写的展品说明。海边劳动的人们。',
      workContext: {
        contribution: '我比较了北斋在这幅和浪涛版画中如何描绘海边劳动的人。',
        process: '我做了一张两栏表格列出两幅版画各自呈现的内容，并请 Ava 对照她的研究检查。',
        outcome: '一段展品说明和一张比较表。',
        reflection: '我的初稿只描述了画面。同学的反馈推动我说明这个比较告诉我们什么。',
        sources: [
          { label: '大都会艺术博物馆馆藏记录', url: met(55739), excerpt: '我的笔记：出自《千绘之海》系列，1832–33 年。' },
          { label: 'Ava 的同伴反馈', excerpt: '表格很清楚。比较它们的重点是什么？' },
        ],
      },
      comments: [],
    },
    {
      title: '夹竹桃', artist: '梵高',
      description: 'Felix 撰写的展品说明。鲜明而平涂的色块。',
      workContext: {
        contribution: '我写了关于平涂鲜艳色块的说明，并提出它们是否受版画影响的问题。',
        process: '我找出没有明暗变化的色块，并在打印稿上标示出来。',
        outcome: '一段以开放问题作结、留给观众思考的展品说明。',
        reflection: '课堂读物说梵高在书信中把法国南部比作日本，但我自己还没读过那些信，所以只把它写成一个问题。',
        sources: [{ label: '大都会艺术博物馆馆藏记录', url: met(436530), excerpt: '我的笔记：梵高，1888 年，布面油画。' }],
      },
      comments: [
        { name: 'Ava', text: '定稿前我们可以在网上馆藏找找那封信吗？这样你就能自己引用。' },
        { name: 'Felix', text: '好，我会去查，找到就更新说明。' },
      ],
    },
  ],
};

const copies: Record<Locale, ClassSampleCopy> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN };

export function getClassSampleCopy(locale: Locale = 'en'): ClassSampleCopy {
  return copies[locale] ?? en;
}
