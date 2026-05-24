import fs from 'fs/promises';

const prerender = false;
const POSTS_FILE = "./src/data/posts.json";
const PUBLIC_DIR = "./public";
async function readPosts() {
  try {
    const data = await fs.readFile(POSTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
async function savePosts(posts) {
  await fs.mkdir("./src/data", { recursive: true });
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}
const GET = async ({ params }) => {
  const posts = await readPosts();
  if (params.id) {
    const post = posts.find((p) => p.id === parseInt(params.id));
    if (!post) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(post), { status: 200 });
  }
  return new Response(JSON.stringify(posts), { status: 200 });
};
const POST = async ({ request }) => {
  try {
    const formData = await request.formData();
    const title = formData.get("title");
    const date = formData.get("date");
    const shortText = formData.get("shortText");
    const fullText = formData.get("fullText");
    const coverFile = formData.get("coverImage");
    const mainFile = formData.get("mainMedia");
    if (!title || !date || !shortText || !fullText) {
      return new Response("Missing fields", { status: 400 });
    }
    const timestamp = Date.now();
    const slug = title.toLowerCase().replace(/[^a-zа-я0-9]+/g, "-");
    await fs.mkdir(`${PUBLIC_DIR}/images/posts`, { recursive: true });
    await fs.mkdir(`${PUBLIC_DIR}/videos/posts`, { recursive: true });
    let coverPath = "";
    let mainPath = "";
    let isVideo = false;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop() || "jpg";
      const filename = `${slug}-cover-${timestamp}.${ext}`;
      coverPath = `/images/posts/${filename}`;
      await fs.writeFile(`${PUBLIC_DIR}${coverPath}`, Buffer.from(await coverFile.arrayBuffer()));
    }
    if (mainFile) {
      isVideo = mainFile.type.startsWith("video/");
      const folder = isVideo ? "videos/posts" : "images/posts";
      const ext = mainFile.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
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
    return new Response("Server error", { status: 500 });
  }
};
const PUT = async ({ request, params }) => {
  try {
    const id = parseInt(params.id);
    const formData = await request.formData();
    let posts = await readPosts();
    const index = posts.findIndex((p) => p.id === id);
    if (index === -1) return new Response("Not found", { status: 404 });
    posts[index].title = formData.get("title");
    posts[index].date = formData.get("date");
    posts[index].shortText = formData.get("shortText");
    posts[index].fullText = formData.get("fullText");
    const coverFile = formData.get("coverImage");
    const mainFile = formData.get("mainMedia");
    if (coverFile) {
      const ext = coverFile.name.split(".").pop() || "jpg";
      const filename = `${posts[index].title.toLowerCase().replace(/[^a-zа-я0-9]+/g, "-")}-cover-${Date.now()}.${ext}`;
      const newPath = `/images/posts/${filename}`;
      await fs.writeFile(`${PUBLIC_DIR}${newPath}`, Buffer.from(await coverFile.arrayBuffer()));
      posts[index].coverImage = newPath;
    }
    if (mainFile) {
      const isVideoNew = mainFile.type.startsWith("video/");
      const folder = isVideoNew ? "videos/posts" : "images/posts";
      const ext = mainFile.name.split(".").pop() || "mp4";
      const filename = `${posts[index].title.toLowerCase().replace(/[^a-zа-я0-9]+/g, "-")}-main-${Date.now()}.${ext}`;
      const newPath = `/${folder}/${filename}`;
      await fs.writeFile(`${PUBLIC_DIR}${newPath}`, Buffer.from(await mainFile.arrayBuffer()));
      posts[index].mainMedia = newPath;
      posts[index].isVideo = isVideoNew;
    }
    await savePosts(posts);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Server error", { status: 500 });
  }
};
const DELETE = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    let posts = await readPosts();
    posts = posts.filter((p) => p.id !== id);
    await savePosts(posts);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Server error", { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    DELETE,
    GET,
    POST,
    PUT,
    prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
