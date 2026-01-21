import { useEffect, useState } from 'react';
import { getImageUrl } from '../lib/imageUrl';

interface UploadData {
  id: number;
  image_name: string;
  text_content: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
  review_comment?: string;
}

export default function ReviewPage() {
  const [data, setData] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [newRecordCount, setNewRecordCount] = useState(0);

  // 获取待审核数据
  const fetchData = async () => {
    try {
      const apiUrl = 'https://api.the3studio.cn';
      const url = apiUrl ? `${apiUrl}/api/pending` : '/api/pending';
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      }
    } catch (err) {
      console.error('获取待审核数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // WebSocket连接
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = 'wss://api.the3studio.cn';
      console.log('Review页面正在连接WebSocket:', wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Review页面WebSocket连接成功');
          setWsConnected(true);
          ws.send(JSON.stringify({ clientName: 'review' }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'newPending' && message.data) {
              setData(prevData => [message.data, ...prevData]);
              setNewRecordCount(prev => prev + 1);
              setTimeout(() => setNewRecordCount(0), 3000);
            }
          } catch (err) {
            console.error('解析WebSocket消息失败:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('Review页面WebSocket连接关闭:', event.code, event.reason);
          setWsConnected(false);
          if (event.code !== 1000) {
            setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (err) => {
          console.error('Review页面WebSocket错误:', err);
          setWsConnected(false);
        };

        return ws;
      } catch (error) {
        console.error('Review页面创建WebSocket连接失败:', error);
        setWsConnected(false);
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close(1000, '组件卸载');
      }
    };
  }, []);

  // 审核操作
  const handleReview = async (id: number, status: 'approved' | 'rejected') => {
    if (!confirm(`确定要${status === 'approved' ? '通过' : '拒绝'}这条记录吗？`)) {
      return;
    }

    setReviewingId(id);
    try {
      const apiUrl = 'https://api.the3studio.cn';

      const url = apiUrl ? `${apiUrl}/api/review/${id}` : `/api/review/${id}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          comment: comment.trim() || undefined
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(status === 'approved' ? '审核通过' : '审核拒绝');
          setData(prevData => prevData.filter(item => item.id !== id));
        } else {
          alert('审核失败: ' + result.error);
        }
      } else {
        alert('审核失败，请稍后重试');
      }
    } catch (error) {
      console.error('审核错误:', error);
      alert('审核失败，请稍后重试');
    } finally {
      setReviewingId(null);
      setComment('');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">内容审核</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {wsConnected ? '实时连接' : '连接断开'}
                </span>
              </div>
              {newRecordCount > 0 && (
                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  +{newRecordCount} 新待审核
                </div>
              )}
              <span className="text-sm text-gray-500">
                待审核: {data.length} 条
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">✅</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无待审核内容</h3>
            <p className="text-gray-500">所有内容都已审核完成</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48">
                  <img
                    src={getImageUrl(item.image_name)}
                    alt="上传的图片"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.jpg';
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    待审核
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-lg font-semibold mb-2 text-gray-900 break-words">
                    {item.text_content}
                  </p>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-500">
                      ID: {item.id}
                    </p>
                    <p className="text-sm text-gray-500">
                      上传时间: {formatDate(item.created_at)}
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="审核备注（可选）"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleReview(item.id, 'approved')}
                      disabled={reviewingId === item.id}
                      className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
                        reviewingId === item.id
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {reviewingId === item.id ? '审核中...' : '通过'}
                    </button>
                    <button
                      onClick={() => handleReview(item.id, 'rejected')}
                      disabled={reviewingId === item.id}
                      className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
                        reviewingId === item.id
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      {reviewingId === item.id ? '审核中...' : '拒绝'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

