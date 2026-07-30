import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ApiReferenceEndpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  summary: string;
  sandboxOnly?: boolean;
  curl: string;
}

const METHOD_VARIANT: Record<ApiReferenceEndpoint["method"], "default" | "secondary" | "destructive"> = {
  GET: "secondary",
  POST: "default",
  DELETE: "destructive",
};

export function ApiReference({ endpoints }: { endpoints: ApiReferenceEndpoint[] }) {
  return (
    <div className="flex flex-col gap-3">
      {endpoints.map((endpoint) => (
        <Card key={`${endpoint.method}-${endpoint.path}`}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Badge variant={METHOD_VARIANT[endpoint.method]}>{endpoint.method}</Badge>
              <code className="text-sm font-normal">{endpoint.path}</code>
              {endpoint.sandboxOnly && <Badge variant="sandbox">sandbox-only</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{endpoint.summary}</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>{endpoint.curl}</code>
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
