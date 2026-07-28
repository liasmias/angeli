import { getLang } from "@/lib/lang";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  return <SignupForm lang={await getLang()} />;
}
