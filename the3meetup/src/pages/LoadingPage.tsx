import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoadingPage() {
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // 模拟加载进度
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // 加载完成后跳转到主页面
          setTimeout(() => {
            navigate('/touchliveshow');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ backgroundColor: '#DCFF92' }}>
      {/* 中间的主logo */}
      <div className="flex-1 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/loading_logo1.png" 
          alt="Loading" 
          className="animate-pulse w-20"
          style={{ height: 'auto' }}
        />
      </div>

      {/* 进度条 */}
      <div className="w-64 h-2 bg-gray-800 rounded-full mb-8">
        <div 
          className="h-full bg-white rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* 底部的logo */}
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/icons/loading_logo.png" 
          alt="Logo" 
          className="w-16 h-auto"
        />
      </div>

      {/* 加载文字 */}
      <div className="text-white text-lg font-medium mb-8">
        {progress < 100 ? '加载中...' : '加载完成'}
      </div>
    </div>
  );
}

