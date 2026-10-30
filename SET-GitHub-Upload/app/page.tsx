import { redirect } from "next/navigation";

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const values=await searchParams;
  const query=new URLSearchParams();
  Object.entries(values).forEach(([key,value])=>Array.isArray(value)?value.forEach(v=>query.append(key,v)):value&&query.set(key,value));
  redirect(`/app.html${query.size?`?${query}`:""}`);
}
