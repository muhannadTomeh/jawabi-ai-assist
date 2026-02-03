import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-foreground">٤٠٤</h1>
        <p className="mb-8 text-xl text-muted-foreground">
          عذراً، الصفحة التي تبحث عنها غير موجودة
        </p>
        <Button asChild>
          <Link to="/">العودة للرئيسية</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
