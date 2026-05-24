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

// ====================== GET (все посты или один) ======================
export const GET: APIRoute = async ({ params }) => {
    const posts = await readPosts();

    if (params.id) {
        const post = posts.find((p: any) => p.id === parseInt(params.id as string));
        if (!post) return new Response('Not found', { status: 404 });
        return new Response(JSON.stringify(post), { status: 200 });
    }

    return new Response(JSON.stringify(posts), { status: 200 });
};

// ====================== POST (создание) ======================
export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        // ... (весь код POST из предыдущей версии)
        const title = formData.get('title') as string;
        const date = formData.get('date') as string;
        const shortText = formData.get('shortText') as string;
        const fullText = formData.get('fullText') as string;
        const coverFile = formData.get('coverImage') as File;
        const mainFile = formData.get('mainMedia') as File;

        if (!title || !date || !shortText || !fullText) {
            return new Response('Missing fields', { status: 400 });
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
        return new Response('Server error', { status: 500 });
    }
};

// ====================== PUT (редактирование) ======================
export const PUT: APIRoute = async ({ request, params }) => {
    try {
        const id = parseInt(params.id as string);
        const formData = await request.formData();
        let posts = await readPosts();
        
        const index = posts.findIndex((p: any) => p.id === id);
        if (index === -1) return new Response('Not found', { status: 404 });

        posts[index].title = formData.get('title') as string;
        posts[index].date = formData.get('date') as string;
        posts[index].shortText = formData.get('shortText') as string;
        posts[index].fullText = formData.get('fullText') as string;

        const coverFile = formData.get('coverImage') as File;
        const mainFile = formData.get('mainMedia') as File;

        if (coverFile) {
            const ext = coverFile.name.split('.').pop() || 'jpg';
            const filename = `${posts[index].title.toLowerCase().replace(/[^a-zа-я0-9]+/g, '-')}-cover-${Date.now()}.${ext}`;
            const newPath = `/images/posts/${filename}`;
            await fs.writeFile(`${PUBLIC_DIR}${newPath}`, Buffer.from(await coverFile.arrayBuffer()));
            posts[index].coverImage = newPath;
        }

        if (mainFile) {
            const isVideoNew = mainFile.type.startsWith('video/');
            const folder = isVideoNew ? 'videos/posts' : 'images/posts';
            const ext = mainFile.name.split('.').pop() || 'mp4';
            const filename = `${posts[index].title.toLowerCase().replace(/[^a-zа-я0-9]+/g, '-')}-main-${Date.now()}.${ext}`;
            const newPath = `/${folder}/${filename}`;
            await fs.writeFile(`${PUBLIC_DIR}${newPath}`, Buffer.from(await mainFile.arrayBuffer()));
            posts[index].mainMedia = newPath;
            posts[index].isVideo = isVideoNew;
        }

        await savePosts(posts);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error(error);
        return new Response('Server error', { status: 500 });
    }
};

// ====================== DELETE ======================
export const DELETE: APIRoute = async ({ params }) => {
    try {
        const id = parseInt(params.id as string);
        let posts = await readPosts();
        posts = posts.filter((p: any) => p.id !== id);
        await savePosts(posts);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error(error);
        return new Response('Server error', { status: 500 });
    }
};