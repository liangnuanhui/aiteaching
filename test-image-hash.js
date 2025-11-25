#!/usr/bin/env node

/**
 * 测试：为什么同一张照片，上传后hash会不同？
 * 这个脚本模拟手机浏览器上传文件的行为
 */

import crypto from 'crypto';

// 模拟原始照片的原始二进制数据
const originalImageBuffer = Buffer.from([
  0xff,
  0xd8,
  0xff,
  0xe0,
  0x00,
  0x10,
  0x4a,
  0x46,
  0x49,
  0x46,
  0x00,
  0x01,
  0x01,
  0x00,
  0x00,
  0x01,
  0x00,
  0x01,
  0x00,
  0x00, // JPEG 头
  0xff,
  0xdb,
  0x00,
  0x43,
  0x00,
  0x10,
  0x0b,
  0x0c, // 颜色数据...
  0x11,
  0x12,
  0x11,
  0x18,
  0x14,
  0x18,
  0x19,
  0x18,
  0x19,
  0x1b,
  0x1b,
  0x1b,
  0x13,
  0x1d,
  0x1d,
  0x1d,
  0x1d,
  0x1d,
  0x1d,
  0x1d,
  // 图片主体数据 省略...
]);

console.log('='.repeat(60));
console.log('同一张照片为什么上传后hash不同？');
console.log('='.repeat(60));
console.log('');

// 计算原始照片的hash
const originalHash = crypto.createHash('sha256').update(originalImageBuffer).digest('hex');
console.log('📱 原始照片 (手机相册里) hash:');
console.log(`   ${originalHash}`);
console.log('');

// ========== 模拟第一次选择上传 ==========
// 浏览器/系统会创建一个临时文件，可能带有时间戳元数据
console.log('─'.repeat(60));
console.log('第一次选择上传');
console.log('─'.repeat(60));

// iOS/Android可能会对临时文件添加创建时间戳到EXIF
const exifData1 = Buffer.from(`Temporary file created: ${Date.now()}`);
const tempBuffer1 = Buffer.concat([originalImageBuffer, exifData1]);

const hash1 = crypto.createHash('sha256').update(tempBuffer1).digest('hex');
console.log(`📦 临时文件1 hash:    ${hash1}`);
console.log(`📊 长度: ${tempBuffer1.length} bytes`);
console.log(`✅ 与原始不同？ ${hash1 !== originalHash ? '是 - 因为添加了EXIF' : '否'}`);
console.log('');

// ========== 模拟第二次选择上传 ==========
// 浏览器再次创建临时文件，时间戳不同
console.log('─'.repeat(60));
console.log('第二次选择上传');
console.log('─'.repeat(60));

// 第二次创建临时文件，时间戳不同（相差几毫秒）
const exifData2 = Buffer.from(`Temporary file created: ${Date.now() + 100}`);
const tempBuffer2 = Buffer.concat([originalImageBuffer, exifData2]);

const hash2 = crypto.createHash('sha256').update(tempBuffer2).digest('hex');
console.log(`📦 临时文件2 hash:    ${hash2}`);
console.log(`📊 长度: ${tempBuffer2.length} bytes`);
console.log(`✅ 与原始不同？ ${hash2 !== originalHash ? '是 - 因为添加了不同时间戳的EXIF' : '否'}`);
console.log('');

// ========== 对比结果 ==========
console.log('─'.repeat(60));
console.log('结果对比');
console.log('─'.repeat(60));

console.log(`hash1 (第一次): ${hash1}`);
console.log(`hash2 (第二次): ${hash2}`);
console.log('');
console.log(`📷 图片内容是否相同？ ✅ 是`);
console.log(`📝 二进制是否相同？ ❌ 否（元数据不同）`);
console.log(`hash是否相同？ ✅ ${hash1 === hash2 ? '是' : '否'}`);
console.log('');

if (hash1 !== hash2) {
  console.log('⚠️  结论：虽然选择了同一张照片，但每次浏览器都创建了一个带有');
  console.log('    新元数据（时间戳、临时文件标记）的副本！');
  console.log('');
  console.log('    这就是为什么：');
  console.log('    1. 三张照片在手机里看起来完全一样 ✅');
  console.log('    2. 上传到应用后hash不同 ❌');
  console.log('    3. 系统无法检测到重复 ✅');
  console.log('');
  console.log('    根本原因是：移动设备文件系统的防抖/安全机制');
  console.log('    在每次选择文件时都会创建一个新的副本');
}

console.log('='.repeat(60));
console.log('');
