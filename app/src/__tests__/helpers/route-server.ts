/**
 * Adapts a Next.js App Router Route Handler (Web Request→Response) into a
 * Node.js http.Server so supertest can drive it over a real socket.
 */
import http from "node:http";

type Handler = (req: Request) => Promise<Response>;

export function makeServer(handler: Handler): http.Server {
  return http.createServer(async (nodeReq, nodeRes) => {
    // Collect body
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const url = `http://localhost${nodeReq.url ?? "/"}`;
    const webReq = new Request(url, {
      method: nodeReq.method ?? "GET",
      headers: nodeReq.headers as Record<string, string>,
      body: rawBody.length > 0 ? rawBody : undefined,
    });

    let webRes: Response;
    try {
      webRes = await handler(webReq);
    } catch (err) {
      nodeRes.writeHead(500, { "Content-Type": "application/json" });
      nodeRes.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }

    // Forward status + headers
    const headers: Record<string, string> = {};
    webRes.headers.forEach((v, k) => { headers[k] = v; });
    nodeRes.writeHead(webRes.status, headers);

    // Stream body
    if (webRes.body) {
      const reader = webRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    }
    nodeRes.end();
  });
}
