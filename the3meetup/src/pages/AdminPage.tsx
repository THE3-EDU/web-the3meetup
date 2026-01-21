import { useEffect, useState } from 'react';
import { getImageUrl } from '../lib/imageUrl';
import { Link } from 'react-router-dom';

interface UploadData {
  id: number;
  image_name: string;
  text_content: string;
  status?: string;
  created_at: string;
  reviewed_at?: string;
  review_comment?: string;
}

export default function AdminPage() {
  const [data, setData] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newRecordCount, setNewRecordCount] = useState(0);
  const [deleteSuccessId, setDeleteSuccessId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'published' | 'all'>('published');

  // 获取历史数据
  const fetchData = async () => {
    try {
      const apiUrl = 'https://api.the3studio.cn';
      const endpoint = activeTab === 'published' ? '/api/uploads' : '/api/uploads/all';
      const url = apiUrl ? `${apiUrl}${endpoint}` : endpoint;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          if (activeTab === 'published') {
            setData(result.data.filter((item: UploadData) => item.status === 'approved'));
          } else {
            setData(result.data);
          }
        }
      }
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket连接
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = 'wss://api.the3studio.cn';

      console.log('Admin页面正在连接WebSocket:', wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Admin页面WebSocket连接成功');
          setWsConnected(true);
          ws.send(JSON.stringify({ clientName: 'admin' }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'newUpload' && message.data) {
              if (activeTab === 'published') {
                setData(prevData => [message.data, ...prevData]);
                setNewRecordCount(prev => prev + 1);
                setTimeout(() => setNewRecordCount(0), 3000);
              }
            } else if (message.type === 'deleteUpload' && message.data) {
              setData(prevData => prevData.filter(item => item.id !== message.data.id));
              setDeleteSuccessId(null);
            }
          } catch (err) {
            console.error('解析WebSocket消息失败:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('Admin页面WebSocket连接关闭:', event.code, event.reason);
          setWsConnected(false);
          if (event.code !== 1000) {
            setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (err) => {
          console.error('Admin页面WebSocket错误:', err);
          setWsConnected(false);
        };

        return ws;
      } catch (error) {
        console.error('Admin页面创建WebSocket连接失败:', error);
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
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // 删除记录
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    setDeletingId(id);
    try {
      const apiUrl = 'https://api.the3studio.cn';
      
      const url = apiUrl ? `${apiUrl}/api/uploads/delete/${id}` : `/api/uploads/delete/${id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDeleteSuccessId(id);
          setTimeout(() => setDeleteSuccessId(null), 3000);
        } else {
          alert('删除失败: ' + result.error);
        }
      } else {
        alert(`删除失败，状态码: ${response.status}`);
      }
    } catch (error) {
      console.error('删除错误:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
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
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-gray-900">后台管理</h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('published')}
                  className={`font-medium pb-1 ${
                    activeTab === 'published'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  已发布内容
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`font-medium pb-1 ${
                    activeTab === 'all'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  全部内容
                </button>
                <Link
                  to="/review"
                  target="_blank"
                  className="text-gray-500 hover:text-gray-700 font-medium"
                >
                  内容审核
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {wsConnected ? '实时连接' : '连接断开'}
                </span>
              </div>
              {newRecordCount > 0 && (
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  +{newRecordCount} 新记录
                </div>
              )}
              <span className="text-sm text-gray-500">
                共 {data.length} 条记录
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无数据</h3>
            <p className="text-gray-500">
              {activeTab === 'published' ? '还没有任何已发布的内容' : '还没有任何内容'}
            </p>
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
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors ${
                      deletingId === item.id
                        ? 'bg-gray-400 cursor-not-allowed'
                        : deleteSuccessId === item.id
                        ? 'bg-green-500'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                    title={deleteSuccessId === item.id ? "删除成功" : "删除"}
                  >
                    {deletingId === item.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : deleteSuccessId === item.id ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-lg font-semibold mb-2 text-gray-900 break-words">
                    {item.text_content}
                  </p>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-500">
                      ID: {item.id}
                    </p>
                    {item.status && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">状态:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status === 'approved' ? '已通过' : 
                           item.status === 'pending' ? '待审核' : '已拒绝'}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </p>
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

