import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kintai", template: "%s · Kintai" },
  description: "A local attendance and leave tracker.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const accountScript = `(function(){
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest&&e.target.closest("[data-account]");
    if(!b)return;
    try{localStorage.setItem("kintai-person",b.getAttribute("data-account"))}catch(err){}
  },true);
  try{
    if(location.pathname==="/me"||location.pathname.indexOf("/me/")===0)return;
    var stored=localStorage.getItem("kintai-person");
    if(!stored){
      if(location.pathname!=="/choose"){
        document.documentElement.style.visibility="hidden";
        location.replace("/choose");
      }
      return;
    }
    if(location.pathname==="/choose"){
      document.documentElement.style.visibility="hidden";
      location.replace("/");
      return;
    }
    var match=document.cookie.match(/(?:^|; )kintai-person=([^;]*)/);
    var cookie=match?decodeURIComponent(match[1]):"";
    if(stored===cookie)return;
    document.cookie="kintai-person="+encodeURIComponent(stored)+"; Path=/; Max-Age=31536000; SameSite=Lax";
    var after=document.cookie.match(/(?:^|; )kintai-person=([^;]*)/);
    if((after?decodeURIComponent(after[1]):"")===stored){
      document.documentElement.style.visibility="hidden";
      location.replace(location.pathname+location.search);
    }
  }catch(err){}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: accountScript }} />
        {children}
      </body>
    </html>
  );
}
