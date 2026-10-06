interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 基础探活接口
    return Response.json({
      status: "ok",
      app: "NuanceTEM",
      timestamp: Date.now(),
      environment: "Cloudflare Pages Functions",
    });
  } catch (error: any) {
    return Response.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
};
