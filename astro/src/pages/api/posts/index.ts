import type { APIRoute } from 'astro';
import fs from 'fs/promises';

export const prerender = false;

const POSTS_FILE = './src/data/posts.json';
const PUBLIC_DIR = './public';

async function readPosts() {
    try {
        const data = await fs.readFile(POSTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function savePosts(posts: any[]) {
    await fs.mkdir('./src/data', { recursive: true });
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// GET /api/posts — все посты
export const GET: APIRoute = async () => {
    const posts = await readPosts();
    return new Response(JSON.stringify(posts), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// POST /api/posts — создание нового
export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();

        const title = formData.get('title') as string;
        const date = formData.get('date') as string;
        const shortText = formData.get('shortText') as string;
        const fullText = formData.get('fullText') as string;
        const coverFile = formData.get('coverImage') as File;
        const mainFile = formData.get('mainMedia') as File;

        if (!title || !date || !shortText || !fullText) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
        }

        const timestamp = Date.now();
        const slug = title.toLowerCase().replace(/[^a-zа-я0-9]+/g, '-');

        await fs.mkdir(`${PUBLIC_DIR}/images/posts`, { recursive: true });
        await fs.mkdir(`${PUBLIC_DIR}/videos/posts`, { recursive: true });

        let coverPath = '';
        let mainPath = '';
        let isVideo = false;

        if (coverFile) {
            const ext = coverFile.name.split('.').pop() || 'jpg';
            const filename = `${slug}-cover-${timestamp}.${ext}`;
            coverPath = `/images/posts/${filename}`;
            await fs.writeFile(`${PUBLIC_DIR}${coverPath}`, Buffer.from(await coverFile.arrayBuffer()));
        }

        if (mainFile) {
            isVideo = mainFile.type.startsWith('video/');
            const folder = isVideo ? 'videos/posts' : 'images/posts';
            const ext = mainFile.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
            const filename = `${slug}-main-${timestamp}.${ext}`;
            mainPath = `/${folder}/${filename}`;
            await fs.writeFile(`${PUBLIC_DIR}${mainPath}`, Buffer.from(await mainFile.arrayBuffer()));
        }

        const posts = await readPosts();
        posts.unshift({
            id: timestamp,
            title,
            date,
            shortText,
            fullText,
            coverImage: coverPath,
            mainMedia: mainPath,
            isVideo
        });

        await savePosts(posts);

        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
};