import { getLang } from "@/lib/lang";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  return <LoginForm lang={await getLang()} />;
}
