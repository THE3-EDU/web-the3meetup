# WebSocket 实时更新功能

## 功能概述

本项目已集成WebSocket功能，实现上传数据的实时推送。当有新数据上传时，所有连接的客户端都会实时收到更新。

## 技术架构

### 服务端
- **WebSocket服务器**: 使用 `ws` 库
- **集成方式**: 自定义HTTP服务器，同时支持Next.js和WebSocket
- **广播机制**: 新数据上传后自动广播给所有连接的客户端

### 客户端
- **WebSocket Hook**: `hooks/useWebSocket.ts`
- **实时更新**: 数据列表组件自动接收WebSocket消息
- **连接状态**: 显示WebSocket连接状态和实时更新状态

## 文件结构

```
├── server.js                    # 自定义服务器（集成WebSocket）
├── lib/websocket.ts            # WebSocket服务器管理
├── hooks/useWebSocket.ts       # WebSocket客户端Hook
├── app/api/upload/route.ts     # 上传API（集成广播功能）
└── app/components/DataList.tsx # 数据列表（支持实时更新）
```

## 消息类型

### 1. 连接消息
```json
{
  "type": "connection",
  "message": "连接成功"
}
```

### 2. 新上传消息
```json
{
  "type": "newUpload",
  "data": {
    "id": 1,
    "image_name": "upload_1234567890.jpg",
    "text_content": "Hello 😊",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 3. 全部数据消息
```json
{
  "type": "allData",
  "data": [...]
}
```

## 使用方法

### 启动服务器
```bash
npm run dev
```

### 功能特点

1. **自动连接**: 页面加载时自动建立WebSocket连接
2. **实时更新**: 新上传的数据立即显示在所有客户端
3. **连接状态**: 显示WebSocket连接状态
4. **自动重连**: 连接断开时自动尝试重连
5. **错误处理**: 完整的错误处理和用户反馈

### 客户端状态显示

- **已连接**: WebSocket连接正常，实时更新开启
- **连接中**: 正在建立WebSocket连接
- **连接错误**: WebSocket连接失败
- **未连接**: WebSocket未连接

## 开发说明

### 添加新的广播消息

1. 在 `lib/websocket.ts` 中添加新的广播方法
2. 在相应的API中调用广播方法
3. 在客户端组件中处理新的消息类型

### 自定义消息处理

```typescript
// 在组件中处理WebSocket消息
useEffect(() => {
  if (!ws) return;

  const handleMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'newUpload':
        // 处理新上传数据
        break;
      case 'customMessage':
        // 处理自定义消息
        break;
    }
  };

  ws.addEventListener('message', handleMessage);
}, [ws]);
```

## 性能优化

- **连接池管理**: 自动清理断开的连接
- **消息队列**: 避免消息丢失
- **重连机制**: 网络中断时自动重连
- **内存管理**: 组件卸载时自动断开连接

## 故障排除

### 常见问题

1. **WebSocket连接失败**
   - 检查服务器是否正常运行
   - 确认端口是否被占用
   - 检查防火墙设置

2. **消息未收到**
   - 检查WebSocket连接状态
   - 确认消息格式是否正确
   - 查看浏览器控制台错误

3. **实时更新不工作**
   - 确认WebSocket连接已建立
   - 检查消息处理逻辑
   - 验证广播功能是否正常

### 调试方法

1. 查看服务器控制台日志
2. 检查浏览器WebSocket连接状态
3. 使用浏览器开发者工具查看WebSocket消息
4. 添加更多的日志输出来追踪问题 