import { getCurrentMember } from "@/lib/auth";
import HeaderInner from "./HeaderInner";

export default async function Header() {
  const member = await getCurrentMember();
  return (
    <HeaderInner
      member={
        member
          ? { id: member.id, name: member.name, role: member.role }
          : null
      }
    />
  );
}
