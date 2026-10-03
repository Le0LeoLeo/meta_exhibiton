// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { publicExhibitionMetadata, exhibitionHtml } from './publicExhibitionPageRoutes.js';
const id='12345678-1234-4234-8234-123456789abc';
const gallery={id:'gallery',owner_id:'owner',is_published:1,title:'<script>bad</script> "Art"',description:'A & B <b>works</b>',template_image:'/templates/cover-art.jpg',scene_json:JSON.stringify({items:[{type:'painting',content:`/api/media/${id}`}]})};
const deps={origin:'https://metaexb.com',getMediaAssetById:vi.fn(async()=>({gallery_id:'gallery',owner_id:'owner',mime_type:'image/png'}))};
it('uses the actual public artwork and escapes metadata while retaining the app shell', async () => {
 const data=await publicExhibitionMetadata(gallery,deps);expect(data.image).toBe(`https://metaexb.com/api/media/${id}`);
 const html=exhibitionHtml('<head><title>App</title></head><script src="/assets/app.js"></script>',data);
 expect(html).toContain('og:title');expect(html).toContain('&quot;Art&quot;');expect(html).not.toContain('<script>bad');expect(html).toContain('/assets/app.js');expect(html).toContain('https://metaexb.com/exhibitions/gallery');
});
it('excludes private or missing galleries and stale foreign media', async () => {
 expect(await publicExhibitionMetadata({...gallery,is_published:0},deps)).toBeNull();expect(await publicExhibitionMetadata(null,deps)).toBeNull();
 const data=await publicExhibitionMetadata(gallery,{...deps,getMediaAssetById:async()=>({gallery_id:'private',owner_id:'owner',mime_type:'image/png'})});expect(data.image).toContain('/templates/cover-art.jpg');
 expect(exhibitionHtml('<head></head>',null)).toContain('noindex,nofollow');
});
it('does not copy bearer URLs or arbitrary remote covers into metadata', async () => {
 const data=await publicExhibitionMetadata({...gallery,cover_image:'https://evil.test/private?accessToken=secret',template_image:'/api/media/'+id+'?accessToken=secret',scene_json:'{"items":{}}'},deps);expect(data.image).toBe('https://metaexb.com/templates/cover-art.jpg');
});
