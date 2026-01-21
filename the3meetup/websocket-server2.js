const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const OSS = require('ali-oss');
const express = require('express');

class WebSocketManager {
  constructor() {
    this.clients = new Map();
    this.id = crypto.randomUUID();
    this.dbPool = null;
    this.ossClient = null;
    this.initDatabase();
    this.initOSS();
    console.log(`[${this.id}] WebSocketManager实例创建`);
  }

  // 初始化数据库连接
  initDatabase() {
    const dbConfig = {
      host: 'localhost',
      user: 'zheng',
      password: process.env.DB_PASSWORD || '19950416',
      database: process.env.DB_NAME || 'the3meetup',
      port: '3306',
      charset: 'utf8mb4'
    };
    this.dbPool = mysql.createPool(dbConfig);
    console.log(`[${this.id}] 数据库连接池初始化完成`);
  }

  // 初始化 OSS 客户端
  initOSS() {
    const region = process.env.OSS_REGION || 'oss-cn-hongkong ';
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID || 'LTAI5tBhrFu4mrMC6cMpSKiC';
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || '8HsSNa0Llu5KUEcJj297J2sGigU9yF';
    const bucket = process.env.OSS_BUCKET || 'the3-meetup-web';

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      console.warn(`[${this.id}] OSS 配置不完整，图片上传功能将不可用`);
      return;
    }

    const config = {
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
    };


    this.ossClient = new OSS(config);
    console.log(`[${this.id}] OSS 客户端初始化完成`);
  }

  // 获取 OSS URL
  getOSSURL(fileName) {
    const bucket = 'the3-meetup-web';
    const region = 'cn-hongkong';
    
    if (region && bucket) {
      return `https://${bucket}.oss-${region}.aliyuncs.com/${fileName}`;
    }
    
    throw new Error('OSS configuration is incomplete');
  }

  // 获取所有上传数据（支持过滤状态）
  async getAllUploadData(status = null) {
    if (!this.dbPool) {
      console.error(`[${this.id}] 数据库连接池未初始化`);
      return [];
    }
    try {
      let query, params;
      if (status) {
        query = 'SELECT * FROM uploads WHERE status = ? ORDER BY created_at DESC';
        params = [status];
      } else {
        query = 'SELECT * FROM uploads ORDER BY created_at DESC';
        params = [];
      }
      const [rows] = await this.dbPool.execute(query, params);
      return rows.map(item => ({
        id: item.id,
        image_name: item.image_name,
        text_content: item.text_content,
        status: item.status,
        created_at: item.created_at,
        reviewed_at: item.reviewed_at,
        review_comment: item.review_comment
      }));
    } catch (error) {
      console.error(`[${this.id}] 获取上传数据失败:`, error);
      return [];
    }
  }

  // 获取待审核数据
  async getPendingData() {
    return this.getAllUploadData('pending');
  }

  // 处理审核操作
  async handleReview(id, status, comment = null) {
    if (!this.dbPool) {
      throw new Error('数据库连接池未初始化');
    }
    try {
      const [result] = await this.dbPool.execute(
        'UPDATE uploads SET status = ?, reviewed_at = NOW(), review_comment = ? WHERE id = ?',
        [status, comment || null, id]
      );

      if (result.affectedRows === 0) {
        throw new Error('记录不存在');
      }

      // 获取更新后的数据
      const [rows] = await this.dbPool.execute(
        'SELECT * FROM uploads WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        throw new Error('记录不存在');
      }

      const updatedData = rows[0];

      // 如果审核通过，通过 WSS 广播
      if (status === 'approved') {
        const cleanData = {
          id: updatedData.id,
          image_name: updatedData.image_name,
          text_content: updatedData.text_content
        };
        this.broadcastNewUploadToWeb(cleanData);
        this.forwardApprovedToTD(cleanData);
      }

      return updatedData;
    } catch (error) {
      console.error(`[${this.id}] 审核操作失败:`, error);
      throw error;
    }
  }

  // 处理删除操作
  async handleDelete(id) {
    if (!this.dbPool) {
      throw new Error('数据库连接池未初始化');
    }
    try {
      const [result] = await this.dbPool.execute(
        'DELETE FROM uploads WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        throw new Error('记录不存在');
      }

      // 通过 WSS 广播删除消息
      this.broadcastDeleteToWeb({ id });
      this.forwardDeleteToTD({ id });

      return true;
    } catch (error) {
      console.error(`[${this.id}] 删除操作失败:`, error);
      throw error;
    }
  }

  // 上传文件到 OSS
  async uploadToOSS(fileBuffer, fileName, contentType = 'image/jpeg') {
    if (!this.ossClient) {
      throw new Error('OSS client is not initialized');
    }
    await this.ossClient.put(fileName, fileBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
    return fileName;
  }

  // 从数据库获取已审核通过的数据
  async fetchUploadData() {
    if (!this.dbPool) {
      console.error(`[${this.id}] 数据库连接池未初始化`);
      return [];
    }
    try {
      const [rows] = await this.dbPool.execute(
        'SELECT * FROM uploads WHERE status = ? ORDER BY created_at DESC',
        ['approved']
      );
      return rows.map(item => ({
        id: item.id,
        image_name: item.image_name,
        text_content: item.text_content
      }));
    } catch (error) {
      console.error(`[${this.id}] 获取上传数据失败:`, error);
      return [];
    }
  }

  // 处理上传消息（图片+文字）
  async handleUpload(message, ws) {
    try {
      const { image, textContent } = message;
      
      // 验证文字内容
      if (!textContent || textContent.length === 0 || textContent.length > 10) {
        ws.send(JSON.stringify({
          type: 'uploadError',
          error: '文字内容不能为空且不能超过10个字符'
        }));
        return;
      }

      let fileName = null;

      // 如果有图片，处理图片上传
      if (image && image.data && image.type) {
        // 验证图片类型
        if (!image.type.startsWith('image/')) {
          ws.send(JSON.stringify({
            type: 'uploadError',
            error: '请上传有效的图片文件'
          }));
          return;
        }

        // 生成唯一文件名，保存到 images 文件夹
        const timestamp = Date.now();
        const fileExtension = image.name ? image.name.split('.').pop() : 'jpg';
        fileName = `images/upload_${timestamp}.${fileExtension}`;

        // 将 base64 或 ArrayBuffer 转换为 Buffer
        let fileBuffer;
        if (image.data.startsWith('data:')) {
          // base64 格式
          const base64Data = image.data.split(',')[1];
          fileBuffer = Buffer.from(base64Data, 'base64');
        } else if (Buffer.isBuffer(image.data)) {
          // 已经是 Buffer
          fileBuffer = image.data;
        } else if (image.data instanceof ArrayBuffer) {
          // ArrayBuffer
          fileBuffer = Buffer.from(image.data);
        } else {
          // 尝试作为 base64 字符串处理
          fileBuffer = Buffer.from(image.data, 'base64');
        }

        // 上传到 OSS 的 images 文件夹
        await this.uploadToOSS(fileBuffer, fileName, image.type);
        console.log(`[${this.id}] 图片已上传到 OSS: ${fileName}`);
      }

      // 保存到数据库
      if (!this.dbPool) {
        throw new Error('数据库连接池未初始化');
      }

      // 如果没有图片，image_name 设置为 null
      // 新上传的数据默认状态为 pending，需要审核
      const [result] = await this.dbPool.execute(
        'INSERT INTO uploads (image_name, text_content, status) VALUES (?, ?, ?)',
        [fileName || null, textContent, 'pending']
      );

      const insertId = result.insertId;
      console.log(`[${this.id}] 数据已保存到数据库，状态为 pending，ID: ${insertId}`);

      // 获取刚插入的数据
      const [rows] = await this.dbPool.execute(
        'SELECT * FROM uploads WHERE id = ?',
        [insertId]
      );

      const newData = rows[0];

      // 构建返回数据
      const uploadResult = {
        id: newData.id,
        image_name: newData.image_name,
        text_content: newData.text_content,
        status: newData.status,
        created_at: newData.created_at
      };

      // 发送成功消息给上传者（状态为 pending）
      ws.send(JSON.stringify({
        type: 'uploadSuccess',
        data: {
          id: insertId,
          imageName: fileName,
          textContent: textContent,
          imageUrl: fileName ? this.getOSSURL(fileName) : null,
          status: 'pending',
          message: '上传成功，等待审核'
        }
      }));

      // 通过 WSS 广播新待审核消息给审核客户端
      this.broadcastNewPendingToReview(uploadResult);

    } catch (error) {
      console.error(`[${this.id}] 处理上传失败:`, error);
      ws.send(JSON.stringify({
        type: 'uploadError',
        error: error.message || '上传失败，请稍后重试'
      }));
    }
  }


  // 发送历史数据给TD客户端
  async sendHistoryToTD(ws, clientInfo) {
    try {
      const uploadData = await this.fetchUploadData();
      console.log(`[${this.id}] 向TD客户端 ${clientInfo.ip} 发送已审核通过的历史数据，共 ${uploadData.length} 条`);
      
      ws.send(JSON.stringify({
        type: 'uploadsData',
        data: uploadData
      }));
    } catch (error) {
      console.error(`[${this.id}] 发送历史数据失败:`, error);
    }
  }

  // 广播新上传数据给所有web客户端
  broadcastNewUploadToWeb(data) {
    console.log(`[${this.id}] === 开始广播新上传数据给web客户端 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    // 移除created_at字段
    const cleanData = {
      id: data.id,
      image_name: data.image_name,
      text_content: data.text_content
    };
    
    let sentCount = 0;
    let webCount = 0;
    
    for (const [ws, info] of this.clients.entries()) {
      if (info.isWeb || info.isAdmin) {
        webCount++;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ 
              type: 'newUpload', 
              data: cleanData 
            }));
            sentCount++;
            console.log(`[${this.id}] 向${info.isAdmin ? 'admin' : 'web'}客户端 ${info.ip} 广播新数据成功`);
          } catch (error) {
            console.error(`[${this.id}] 向${info.isAdmin ? 'admin' : 'web'}客户端广播数据失败:`, error);
          }
        }
      }
    }
    
    console.log(`[${this.id}] 广播给web客户端完成: ${sentCount}/${webCount} 个web客户端`);
  }

  // 广播删除消息给所有web客户端
  broadcastDeleteToWeb(data) {
    console.log(`[${this.id}] === 开始广播删除消息给web客户端 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    let sentCount = 0;
    let webCount = 0;
    
    for (const [ws, info] of this.clients.entries()) {
      if (info.isWeb || info.isAdmin) {
        webCount++;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ 
              type: 'deleteUpload', 
              data: { id: data.id }
            }));
            sentCount++;
            console.log(`[${this.id}] 向${info.isAdmin ? 'admin' : 'web'}客户端 ${info.ip} 广播删除消息成功`);
          } catch (error) {
            console.error(`[${this.id}] 向${info.isAdmin ? 'admin' : 'web'}客户端广播删除消息失败:`, error);
          }
        }
      }
    }
    
    console.log(`[${this.id}] 广播删除消息给web客户端完成: ${sentCount}/${webCount} 个web客户端`);
  }

  // 广播新待审核消息给所有review客户端
  broadcastNewPendingToReview(data) {
    console.log(`[${this.id}] === 开始广播新待审核消息给review客户端 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    let sentCount = 0;
    let reviewCount = 0;
    
    for (const [ws, info] of this.clients.entries()) {
      if (info.isReview) {
        reviewCount++;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ 
              type: 'newPending', 
              data: data 
            }));
            sentCount++;
            console.log(`[${this.id}] 向review客户端 ${info.ip} 广播新待审核消息成功`);
          } catch (error) {
            console.error(`[${this.id}] 向review客户端广播新待审核消息失败:`, error);
          }
        }
      }
    }
    
    console.log(`[${this.id}] 广播给review客户端完成: ${sentCount}/${reviewCount} 个review客户端`);
  }

  // 转发审核通过的数据给TD客户端
  forwardApprovedToTD(data) {
    console.log(`[${this.id}] === 开始转发审核通过数据给TD客户端 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    // 移除created_at字段
    const cleanData = {
      id: data.id,
      image_name: data.image_name,
      text_content: data.text_content
    };

    let sentCount = 0;
    let tdCount = 0;
    
    for (const [ws, info] of this.clients.entries()) {
      if (info.isTD) {
        tdCount++;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ 
              type: 'newUpload', 
              data: cleanData 
            }));
            sentCount++;
            console.log(`[${this.id}] 向TD客户端 ${info.ip} 转发审核通过数据成功`);
          } catch (error) {
            console.error(`[${this.id}] 向TD客户端转发审核通过数据失败:`, error);
          }
        }
      }
    }
    
    console.log(`[${this.id}] 转发审核通过数据给TD客户端完成: ${sentCount}/${tdCount} 个TD客户端`);
  }

  // 转发删除消息给TD客户端
  forwardDeleteToTD(data) {
    console.log(`[${this.id}] === 开始转发删除消息给TD客户端 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    let sentCount = 0;
    let tdCount = 0;
    

    for (const [ws, info] of this.clients.entries()) {
      if (info.isTD) {
        tdCount++;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ 
              type: 'deleteUpload', 
              data: { id: data.id }
            }));
            sentCount++;
            console.log(`[${this.id}] 向TD客户端 ${info.ip} 转发删除消息成功`);
          } catch (error) {
            console.error(`[${this.id}] 向TD客户端转发删除消息失败:`, error);
          }
        }
      }
    }
    
    console.log(`[${this.id}] 转发删除消息给TD客户端完成: ${sentCount}/${tdCount} 个TD客户端`);
  }

  initialize(port = 3001) {
    console.log(`[${this.id}] 开始初始化HTTPS/WSS服务器，端口: ${port}`);

    // SSL 证书路径配置（支持跨平台）
    const sslCertPath = process.env.SSL_CERT_PATH || 'C:\\ssl\\server.crt';
    const sslKeyPath = process.env.SSL_KEY_PATH || 'C:\\ssl\\server.key';
    
    // 尝试读取 SSL 证书
    let sslOptions = null;
    try {
      // 处理跨平台路径（Windows 路径转换为实际路径）
      let certPath = sslCertPath;
      let keyPath = sslKeyPath;
      
      // 如果是 Windows 路径但在非 Windows 系统上，尝试转换
      if (process.platform !== 'win32') {
        // 如果在 macOS/Linux 上，尝试使用 /ssl/ 或其他常见路径
        if (certPath.includes('C:\\') || certPath.includes('C:/')) {
          certPath = '/ssl/server.crt';
          keyPath = '/ssl/server.key';
        }
      }
      
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        sslOptions = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
        console.log(`[${this.id}] SSL 证书加载成功: ${certPath}, ${keyPath}`);
      } else {
        console.warn(`[${this.id}] SSL 证书文件不存在，将使用 HTTP/WS (仅开发环境)`);
        console.warn(`[${this.id}] 证书路径: ${certPath}`);
        console.warn(`[${this.id}] 密钥路径: ${keyPath}`);
      }
    } catch (error) {
      console.error(`[${this.id}] 读取 SSL 证书失败:`, error.message);
      console.warn(`[${this.id}] 将使用 HTTP/WS (仅开发环境)`);
    }

    // 创建 Express 应用
    const app = express();
    // 增加请求体大小限制到 50MB（用于处理大图片的 base64 数据）
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // 设置 CORS
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // 根路由
    app.get('/', (req, res) => {
      res.send('WebSocket & HTTPS Server Running');
    });

    // 获取已审核通过的上传数据
    app.get('/api/uploads', async (req, res) => {
      try {
        const data = await this.getAllUploadData('approved');
        res.json({ success: true, data });
      } catch (error) {
        console.error(`[${this.id}] 获取上传数据失败:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取所有上传数据
    app.get('/api/uploads/all', async (req, res) => {
      try {
        const data = await this.getAllUploadData();
        res.json({ success: true, data });
      } catch (error) {
        console.error(`[${this.id}] 获取所有上传数据失败:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取待审核数据
    app.get('/api/pending', async (req, res) => {
      try {
        const data = await this.getPendingData();
        res.json({ success: true, data });
      } catch (error) {
        console.error(`[${this.id}] 获取待审核数据失败:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 上传接口（HTTPS POST）
    app.post('/api/upload', async (req, res) => {
      try {
        const { image, textContent } = req.body;
        
        // 验证必须同时有图片和文字
        if (!textContent || textContent.trim().length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: '请输入文字内容' 
          });
        }
        
        if (textContent.trim().length > 10) {
          return res.status(400).json({ 
            success: false, 
            error: '文字内容不能超过10个字符' 
          });
        }
        
        if (!image || !image.data || !image.type) {
          return res.status(400).json({ 
            success: false, 
            error: '请上传图片' 
          });
        }

        let fileName = null;

        // 处理图片上传
        if (image && image.data && image.type) {
          // 验证图片类型
          if (!image.type.startsWith('image/')) {
            return res.status(400).json({ 
              success: false, 
              error: '请上传有效的图片文件' 
            });
          }

          // 生成唯一文件名，保存到 images 文件夹
          const timestamp = Date.now();
          const fileExtension = image.name ? image.name.split('.').pop() : 'jpg';
          fileName = `images/upload_${timestamp}.${fileExtension}`;

          // 将 base64 转换为 Buffer
          let fileBuffer;
          if (image.data.startsWith('data:')) {
            // base64 格式
            const base64Data = image.data.split(',')[1];
            fileBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // 尝试作为 base64 字符串处理
            fileBuffer = Buffer.from(image.data, 'base64');
          }

          // 上传到 OSS 的 images 文件夹
          await this.uploadToOSS(fileBuffer, fileName, image.type);
          console.log(`[${this.id}] 图片已上传到 OSS: ${fileName}`);
        }

        // 保存到数据库
        if (!this.dbPool) {
          throw new Error('数据库连接池未初始化');
        }

        // 新上传的数据默认状态为 pending，需要审核
        const [result] = await this.dbPool.execute(
          'INSERT INTO uploads (image_name, text_content, status) VALUES (?, ?, ?)',
          [fileName || null, textContent, 'pending']
        );

        const insertId = result.insertId;
        console.log(`[${this.id}] 数据已保存到数据库，状态为 pending，ID: ${insertId}`);

        // 获取刚插入的数据
        const [rows] = await this.dbPool.execute(
          'SELECT * FROM uploads WHERE id = ?',
          [insertId]
        );

        const newData = rows[0];

        // 构建返回数据
        const uploadResult = {
          id: newData.id,
          image_name: newData.image_name,
          text_content: newData.text_content,
          status: newData.status,
          created_at: newData.created_at
        };

        // 通过 WSS 广播新待审核消息给审核客户端
        this.broadcastNewPendingToReview(uploadResult);

        // 返回成功响应
        res.json({ 
          success: true, 
          data: {
            id: insertId,
            imageName: fileName,
            textContent: textContent,
            imageUrl: fileName ? this.getOSSURL(fileName) : null,
            status: 'pending',
            message: '上传成功，等待审核'
          }
        });

      } catch (error) {
        console.error(`[${this.id}] 处理上传失败:`, error);
        res.status(500).json({ 
          success: false, 
          error: error.message || '上传失败，请稍后重试' 
        });
      }
    });

    // 审核操作
    app.post('/api/review/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { status, comment } = req.body;
        
        if (!status || !['approved', 'rejected'].includes(status)) {
          return res.status(400).json({ success: false, error: '无效的审核状态' });
        }

        const updatedData = await this.handleReview(id, status, comment);
        res.json({ success: true, data: updatedData, message: `审核${status === 'approved' ? '通过' : '拒绝'}成功` });
      } catch (error) {
        console.error(`[${this.id}] 审核操作失败:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 删除上传数据
    app.delete('/api/uploads/delete/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await this.handleDelete(id);
        res.json({ success: true, message: '删除成功' });
      } catch (error) {
        console.error(`[${this.id}] 删除操作失败:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 兼容旧路由：转发新上传数据（审核通过后）
    app.post('/new-upload', async (req, res) => {
      try {
        const data = req.body;
        console.log(`[${this.id}] 收到新上传数据:`, data);
        
        // 转发给TD客户端（审核通过的数据）
        this.forwardApprovedToTD(data);
        
        // 广播给所有web客户端
        this.broadcastNewUploadToWeb(data);
        
        res.json({ success: true, message: '转发完成' });
      } catch (error) {
        console.error(`[${this.id}] 处理新上传数据失败:`, error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // 兼容旧路由：转发删除数据
    app.post('/delete-upload', async (req, res) => {
      try {
        const data = req.body;
        console.log(`[${this.id}] 收到删除数据:`, data);
        
        // 广播删除消息给所有web客户端
        this.broadcastDeleteToWeb(data);
        
        // 转发删除消息给TD客户端
        this.forwardDeleteToTD(data);
        
        res.json({ success: true, message: '删除广播完成' });
      } catch (error) {
        console.error(`[${this.id}] 处理删除数据失败:`, error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // 兼容旧路由：转发新待审核数据
    app.post('/new-pending', async (req, res) => {
      try {
        const data = req.body;
        console.log(`[${this.id}] 收到新待审核数据:`, data);
        
        // 广播新待审核消息给所有review客户端
        this.broadcastNewPendingToReview(data);
        
        res.json({ success: true, message: '新待审核消息广播完成' });
      } catch (error) {
        console.error(`[${this.id}] 处理新待审核数据失败:`, error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // 获取服务器状态
    app.get('/status', (req, res) => {
      const clientInfo = this.getClientInfo();
      res.json({ 
        success: true, 
        clients: clientInfo,
        totalClients: this.clients.size,
        tdClients: clientInfo.filter(c => c.isTD).length
      });
    });

    // 创建服务器（HTTPS 或 HTTP）
    const server = sslOptions 
      ? https.createServer(sslOptions, app)
      : http.createServer(app);

    // 创建WebSocket服务器
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      console.log(`[${this.id}] 新的WebSocket连接建立，IP: ${ip}`);
      console.log(`[${this.id}] 连接前clients Map大小: ${this.clients.size}`);
      
      ws.isAlive = true;

      // 初始化客户端信息
      const clientInfo = {
        isTD: false,
        ip: ip,
        clientName: null,
        connectedAt: new Date()
      };

      this.clients.set(ws, clientInfo);
      console.log(`[${this.id}] 连接后clients Map大小: ${this.clients.size}`);

      // 发送欢迎消息
      ws.send(JSON.stringify({ type: 'connection', message: 'success' }));

      // 处理客户端消息
      ws.on('message', async (data) => {
        try {
          let messageStr = '';
          
          // 处理不同类型的数据格式
          if (Buffer.isBuffer(data)) {
            // Buffer 类型，转换为字符串
            messageStr = data.toString('utf8');
          } else if (data instanceof ArrayBuffer) {
            // ArrayBuffer 类型，转换为字符串
            messageStr = Buffer.from(data).toString('utf8');
          } else if (typeof data === 'string') {
            // 字符串类型，直接使用
            messageStr = data;
          } else {
            // 其他类型，尝试转换
            messageStr = String(data);
          }

          // 尝试解析 JSON
          let message;
          try {
            message = JSON.parse(messageStr);
          } catch (parseError) {
            console.error(`[${this.id}] JSON 解析失败:`, parseError);
            console.error(`[${this.id}] 原始数据 (前100字符):`, messageStr.substring(0, 100));
            // 如果是二进制数据但无法解析为 JSON，可能是图片数据
            if (Buffer.isBuffer(data) && data.length > 1000) {
              console.log(`[${this.id}] 收到二进制数据（可能是图片），大小: ${data.length} bytes`);
            }
            return;
          }

          console.log(`[${this.id}] 收到客户端消息类型: ${message.type}`);
          
          // 处理上传消息
          if (message.type === 'upload') {
            await this.handleUpload(message, ws);
            return;
          }
          
          if (message.clientName) {
            // 处理客户端标识
            const client = this.clients.get(ws);
            if (client) {
              client.clientName = message.clientName;
              
              // 判断是否为TD客户端
              if (message.clientName === 'TD') {
                client.isTD = true;
                console.log(`[${this.id}] 客户端标识为TD: ${ip}`);
                
                // TD客户端连接后，立即发送历史数据
                this.sendHistoryToTD(ws, client);
              } else if (message.clientName === 'web') {
                client.isWeb = true;
                console.log(`[${this.id}] 客户端标识为web: ${ip}`);
              } else if (message.clientName === 'admin') {
                client.isAdmin = true;
                console.log(`[${this.id}] 客户端标识为admin: ${ip}`);
              } else if (message.clientName === 'review') {
                client.isReview = true;
                console.log(`[${this.id}] 客户端标识为review: ${ip}`);
              }
              
              // 发送确认消息
              ws.send(JSON.stringify({
                type: 'clientIdentified',
                clientName: message.clientName,
                isTD: client.isTD,
                isWeb: client.isWeb
              }));
              
              console.log(`[${this.id}] 客户端标识完成，当前clients Map大小: ${this.clients.size}`);
              this.checkClientStatus();
            }
          }
        } catch (error) {
          console.error(`[${this.id}] 处理消息失败:`, error);
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'error',
              error: '处理消息失败: ' + error.message
            }));
          }
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        const client = this.clients.get(ws);
        console.log(`[${this.id}] WebSocket连接关闭，IP: ${client?.ip || ip}`);
        console.log(`[${this.id}] 关闭前clients Map大小: ${this.clients.size}`);
        this.clients.delete(ws);
        console.log(`[${this.id}] 关闭后clients Map大小: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        console.error(`[${this.id}] WebSocket错误:`, error);
        this.clients.delete(ws);
      });
    });

    // 启动服务器
    server.listen(port, () => {
      const protocol = sslOptions ? 'https/wss' : 'http/ws';
      const wsProtocol = sslOptions ? 'wss' : 'ws';
      const httpProtocol = sslOptions ? 'https' : 'http';
      const host = process.env.WS_HOST || 'localhost';
      console.log(`✅ 服务器启动成功，端口: ${port}`);
      console.log(`✅ 协议: ${protocol}`);
      console.log(`✅ HTTPS API: ${httpProtocol}://${host}:${port}`);
      console.log(`✅ WebSocket URL: ${wsProtocol}://${host}:${port}`);
      if (process.env.WS_DOMAIN) {
        console.log(`✅ 域名访问: ${httpProtocol}://${process.env.WS_DOMAIN}:${port}`);
        console.log(`✅ WebSocket 域名: ${wsProtocol}://${process.env.WS_DOMAIN}:${port}`);
      }
      if (!sslOptions) {
        console.warn(`⚠️  警告: 当前使用 HTTP/WS，生产环境请配置 SSL 证书`);
      }
    });

    return server;
  }

  checkClientStatus() {
    console.log(`[${this.id}] === 检查客户端状态 ===`);
    console.log(`[${this.id}] 当前clients Map大小: ${this.clients.size}`);
    
    if (this.clients.size === 0) {
      console.log(`[${this.id}] 警告: clients Map为空！`);
    } else {
      for (const [ws, info] of this.clients.entries()) {
        console.log(`[${this.id}] - ${info.ip}: clientName=${info.clientName}, isTD=${info.isTD}, isWeb=${info.isWeb}, readyState=${ws.readyState}, isAlive=${ws.isAlive}`);
      }
    }
    console.log(`[${this.id}] === 客户端状态检查完成 ===`);
  }

  // 获取客户端信息（用于API调用）
  getClientInfo() {
    const clientList = [];
    for (const [ws, info] of this.clients.entries()) {
      clientList.push({
        ip: info.ip,
        isTD: info.isTD,
        isWeb: info.isWeb,
        clientName: info.clientName,
        connectedAt: info.connectedAt,
        isConnected: ws.readyState === 1,
        isAlive: ws.isAlive
      });
    }
    return clientList;
  }
}

// 创建单例实例
const wsManager = new WebSocketManager();

// 启动WebSocket服务器
const port = 443;
wsManager.initialize(port);

// 导出实例供其他模块使用
module.exports = { wsManager }; 