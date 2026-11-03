import { errorMessage } from "@/lib/errors";

export function Banner({ code }: { code?: string }) {
  const message = errorMessage(code);
  if (!message) return null;
  return (
    <p className="banner" role="alert">
      {message}
    </p>
  );
}
