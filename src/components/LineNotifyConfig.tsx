/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import CustomSelect from "./CustomSelect";
import { RepairRequest } from '../types';
import { Smartphone, Send, Key, HelpCircle, CheckCircle, Code, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';

interface LineNotifyConfigProps {
  token: string;
  onUpdateToken: (token: string) => void;
  repairs: RepairRequest[];
  onUpdateRepair: (repair: RepairRequest) => void;
}

export default function LineNotifyConfig({ token, onUpdateToken, repairs, onUpdateRepair }: LineNotifyConfigProps) {
  const [inputToken, setInputToken] = useState(token);
  const [channelSecret, setChannelSecret] = useState(localStorage.getItem('dtx_line_channel_secret') || '');
  const [isSaved, setIsSaved] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState<string>(repairs[0]?.id || '');
  const [showJson, setShowJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Chat message simulation state
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'bot' | 'user'; text?: string; isFlex?: boolean; flexData?: RepairRequest }>>([
    {
      sender: 'bot',
      text: 'สวัสดีครับ! ยินดีต้อนรับสู่ระบบอัตโนมัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ [ระบบบริการ]\n\nเมื่อมีการกรอกใบแจ้งซ่อมเครื่องตรวจน้ำตาลปลายนิ้ว (DTX) จากพยาบาลที่วอร์ด ตั๋วส่งซ่อม Flex Card จะพ่นเข้าห้องแชทของทีมช่างทันที!'
    }
  ]);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateToken(inputToken.trim());
    localStorage.setItem('dtx_line_channel_secret', channelSecret.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const activeRepair = repairs.find(r => r.id === selectedRepairId) || repairs[0];

  const handlePushFlexMessage = () => {
    if (!activeRepair) return;
    
    // Add Flex Card to history
    setChatHistory(prev => [
      ...prev,
      {
        sender: 'bot',
        isFlex: true,
        flexData: activeRepair
      }
    ]);
  };

  // Simulate Accepting job from LINE Flex Card button
  const handleAcceptRepairFromLine = (rep: RepairRequest) => {
    // 1. Update the repair request globally
    const updated: RepairRequest = {
      ...rep,
      status: 'repairing',
      operatorName: 'ทนพ. สมชาย (รับงานทางไลน์)'
    };
    onUpdateRepair(updated);

    // 2. Add simulated message back to the chat history
    setChatHistory(prev => [
      ...prev,
      {
        sender: 'user',
        text: `[รับงานซ่อม] ช่างสมชาย ได้กดรับใบงานหมายเลข ${rep.id} ผ่าน LINE Flex Card เรียบร้อย`
      },
      {
        sender: 'bot',
        text: `[รับทราบ] ระบบทำการลงบันทึกข้อมูลเรียบร้อย:\n\n• เลขที่ตั๋ว: ${rep.id}\n• เครื่อง: ${rep.serialNumber} (${rep.ward})\n• สถานะบนเว็บ: อัปเดตเป็น "กำลังดำเนินการซ่อม" [อยู่ระหว่างดำเนินการ]\n\nพยาบาลที่หอผู้ป่วยสามารถตรวจติดตามสถานะใหม่ได้จากหน้าเว็บทันที!`
      }
    ]);
  };

  // Generate LINE Flex Message JSON payload for developer reference
  const getFlexJsonPayload = (rep: RepairRequest) => {
    if (!rep) return '{}';
    return JSON.stringify({
      "type": "flex",
      "altText": `แจ้งซ่อมด่วนเครื่อง DTX: ${rep.serialNumber} (${rep.ward})`,
      "contents": {
        "type": "bubble",
        "size": "mega",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "ใบนำส่งซ่อม POCT GLUCOSE",
              "weight": "bold",
              "color": "#ffffff",
              "size": "md"
            },
            {
              "type": "text",
              "text": "โรงพยาบาลสังขะ กลุ่มงานเทคนิคการแพทย์",
              "color": "#e0f2fe",
              "size": "xs",
              "margin": "xs"
            }
          ],
          "backgroundColor": "#0284c7",
          "paddingAll": "md"
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "เลขใบซ่อม",
                  "color": "#64748b",
                  "size": "xs",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": rep.id,
                  "weight": "bold",
                  "size": "xs",
                  "color": "#1e293b",
                  "flex": 4
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "เครื่องตรวจ",
                  "color": "#64748b",
                  "size": "xs",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": rep.serialNumber,
                  "weight": "bold",
                  "size": "xs",
                  "color": "#0284c7",
                  "flex": 4
                }
              ],
              "margin": "xs"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text": "หน่วยงาน",
                  "color": "#64748b",
                  "size": "xs",
                  "flex": 2
                },
                {
                  "type": "text",
                  "text": rep.ward,
                  "weight": "bold",
                  "size": "xs",
                  "color": "#1e293b",
                  "flex": 4
                }
              ],
              "margin": "xs"
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "อาการชำรุดที่พยาบาลแจ้ง:",
                  "color": "#64748b",
                  "size": "xs",
                  "weight": "bold"
                },
                {
                  "type": "text",
                  "text": rep.reportedProblem,
                  "color": "#dc2626",
                  "size": "xs",
                  "wrap": true,
                  "margin": "xs"
                }
              ],
              "margin": "md",
              "backgroundColor": "#fef2f2",
              "paddingAll": "sm",
              "cornerRadius": "md"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "กดรับงานซ่อมทันที",
                "data": `action=accept&id=${rep.id}`
              },
              "style": "primary",
              "color": "#059669",
              "height": "sm"
            }
          ]
        }
      }
    }, null, 2);
  };

  const copyJsonToClipboard = () => {
    if (!activeRepair) return;
    navigator.clipboard.writeText(getFlexJsonPayload(activeRepair));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6 animate-scale-up" id="line-config-panel">
      {/* Header */}
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <Smartphone size={20} className="text-sky-600" />
          <span>การแจ้งเตือนและรับงานผ่าน LINE Messaging API (Flex Card)</span>
        </h2>
        <p className="text-xs text-slate-400">
          ตั้งค่าการสื่อสารกับทีมช่างเทคนิคผ่านไลน์กลุ่มด้วยตั๋วซ่อม Flex Card อัจฉริยะ ช่างสามารถคลิก "รับงานซ่อม" บนไลน์เพื่อซิงก์สถานะตรงกับเว็บไซต์ของโรงพยาบาลโดยอัตโนมัติ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - Settings or Guides */}
        <div className="lg:col-span-7 space-y-6 text-xs text-slate-600">
          
          {/* Main Credentials Inputs */}
          <form onSubmit={handleSaveToken} className="space-y-4 bg-sky-50/20 p-5 rounded-xl border border-sky-100/70">
            <h3 className="font-bold text-slate-800 text-xs flex items-center">
              <Key size={14} className="mr-1 text-sky-600" />
              <span>ระบุสิทธิ์เชื่อมต่อ LINE Messaging API (Developer)</span>
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Channel Access Token *</label>
                  <input
                    type="text"
                    placeholder="กรอก Channel Access Token ยาว ๆ..."
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="w-full text-[11px] p-2.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Channel Secret</label>
                  <input
                    type="password"
                    placeholder="กรอก Channel Secret..."
                    value={channelSecret}
                    onChange={(e) => setChannelSecret(e.target.value)}
                    className="w-full text-[11px] p-2.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-[10px] space-y-1 leading-relaxed">
                <span className="font-bold text-slate-700 block">Webhook URL ของระบบเซิร์ฟเวอร์:</span>
                <code className="bg-slate-50 text-sky-700 font-mono px-1 rounded block truncate py-1 border border-slate-100 select-all">
                  https://dtx-sangkha.pages.dev/api/line-webhook
                </code>
                <p className="text-slate-400">
                  * นำ URL นี้ไปป้อนลงในช่อง <strong className="text-slate-600">"Webhook URL"</strong> ในหน้า LINE Developers Console เพื่อให้ปุ่มตอบรับงานส่งสัญญาณกลับมายังเว็บได้แบบเรียลไทม์
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
              {isSaved ? (
                <span className="text-emerald-600 font-bold text-xs flex items-center">
                  <CheckCircle size={14} className="mr-1" /> บันทึกเชื่อมโยงลงในระบบแล้ว!
                </span>
              ) : (
                <span></span>
              )}
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-2xs"
              >
                บันทึกค่าเชื่อมโยง
              </button>
            </div>
          </form>

          {/* Interactive Trigger Flex Message Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-150/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center">
                <Send size={13} className="mr-1.5 text-sky-600" />
                <span>ทดสอบจำลองส่งตั๋วซ่อม Flex Card เข้ากลุ่ม LINE</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowJson(!showJson)}
                className="text-[10px] text-sky-600 hover:underline font-bold flex items-center space-x-1"
              >
                <Code size={12} />
                <span>{showJson ? 'ซ่อนโครงสร้าง JSON' : 'ดูโครงสร้าง JSON ตั๋วซ่อม'}</span>
              </button>
            </div>

            {repairs.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">เลือกตั๋วส่งซ่อมเพื่อทดสอบ:</label>
                    <CustomSelect
                      value={selectedRepairId}
                      onChange={(e) => setSelectedRepairId(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                    >
                      {repairs.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.id} - {rep.serialNumber} ({rep.ward}) - อาการ: {rep.reportedProblem}
                        </option>
                      ))}
                    </CustomSelect>
                  </div>
                  <button
                    type="button"
                    onClick={handlePushFlexMessage}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-1 transition-all shadow-xs"
                  >
                    <Send size={12} />
                    <span>ยิงตั๋วเข้ามือถือจำลอง</span>
                  </button>
                </div>

                {showJson && activeRepair && (
                  <div className="space-y-2 animate-scale-up">
                    <div className="flex justify-between items-center bg-slate-800 text-slate-300 p-2 rounded-t-lg border-b border-slate-700">
                      <span className="text-[10px] font-mono">flex-message-payload.json</span>
                      <button
                        type="button"
                        onClick={copyJsonToClipboard}
                        className="text-[9px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white font-bold flex items-center space-x-0.5"
                      >
                        {copiedJson ? <CheckCircle size={10} className="text-emerald-400" /> : <Code size={10} />}
                        <span>{copiedJson ? 'คัดลอกแล้ว!' : 'คัดลอก JSON'}</span>
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-b-lg overflow-x-auto text-[9px] font-mono leading-relaxed max-h-56">
                      {getFlexJsonPayload(activeRepair)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">ไม่พบใบแจ้งซ่อมสำหรับการทดลองส่งตั๋ว</p>
            )}
          </div>

          {/* Quick Setup instructions block */}
          <div className="space-y-3 bg-slate-50 p-4.5 rounded-xl border border-slate-150/70">
            <h4 className="font-bold text-slate-800 text-xs flex items-center">
              <HelpCircle size={14} className="mr-1 text-sky-600" />
              <span>ความปลอดภัยและความเสถียรของระบบ</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              การผูก LINE Messaging API มีความปลอดภัยระดับสูงเนื่องจากทำงานผ่านโปรโตคอล HTTPS ตั๋วซ่อม Flex Card ช่วยรวบยอดรายละเอียดสำคัญให้ช่างเห็นชัดเจน ไม่สับสน โดยช่างไม่ต้องเปิดเครื่องคอมพิวเตอร์เพื่อค้นหาตั๋ว และความสามารถในการกดยืนยันซ่อมได้ทันที ทำให้เวลาทำงาน (Turnaround Time) ลดลงอย่างมีนัยสำคัญตามเกณฑ์มาตรฐานงาน POCT คณะกรรมการคุณภาพโรงพยาบาลสังขะ
            </p>
          </div>
        </div>

        {/* Right column - Simulated Smartphone Mockup with soft light blue accents */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[320px] bg-sky-100 rounded-[36px] p-3 border-4 border-slate-400 shadow-lg relative flex flex-col overflow-hidden">
            {/* Phone speaker and notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-800 rounded-full z-20 flex items-center justify-center space-x-1.5">
              <div className="w-10 h-1 bg-slate-600 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
            </div>

            {/* Simulated Screen */}
            <div className="bg-sky-50/50 flex-1 rounded-[28px] overflow-hidden flex flex-col pt-6 font-sans relative shadow-inner min-h-[500px]">
              {/* LINE Header */}
              <div className="bg-[#243447] text-white py-2.5 px-3 flex items-center space-x-2 shrink-0">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-[9px]">L</div>
                <div className="leading-tight">
                  <span className="text-[10px] font-bold block leading-none">LINE ทีมช่างเทคนิคการแพทย์</span>
                  <span className="text-[8px] text-slate-300 block">ออนไลน์ • บอทส่งซ่อม DTX</span>
                </div>
              </div>

              {/* Chat messages viewport */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none flex flex-col">
                {chatHistory.map((msg, index) => {
                  if (msg.isFlex && msg.flexData) {
                    const rep = msg.flexData;
                    return (
                      <div key={index} className="space-y-1 animate-scale-up self-start max-w-[90%]">
                        <span className="text-[8px] text-slate-400 font-bold block ml-1">LINE Bot (Flex Card)</span>
                        {/* Beautiful Flex message design mockup */}
                        <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden flex flex-col">
                          {/* Flex Header */}
                          <div className="bg-sky-600 text-white p-3 space-y-0.5">
                            <span className="text-[10px] font-extrabold tracking-wide block uppercase">ใบนำส่งซ่อม POCT Glucose</span>
                            <span className="text-[8px] text-sky-100 block">กลุ่มงานเทคนิคการแพทย์ รพ.สังขะ</span>
                          </div>

                          {/* Flex Body */}
                          <div className="p-3.5 space-y-2 text-[10px] text-slate-600">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-50">
                              <span className="text-slate-400 font-medium">เลขตั๋วซ่อม</span>
                              <span className="font-mono font-bold text-slate-800">{rep.id}</span>
                            </div>
                            <div className="flex justify-between items-center pb-1 border-b border-slate-50">
                              <span className="text-slate-400 font-medium">เครื่องตรวจ DTX</span>
                              <span className="font-bold text-sky-600 font-mono">{rep.serialNumber}</span>
                            </div>
                            <div className="flex justify-between items-center pb-1 border-b border-slate-50">
                              <span className="text-slate-400 font-medium">วอร์ดผู้ส่ง</span>
                              <span className="font-bold text-slate-800">{rep.ward}</span>
                            </div>

                            <div className="space-y-1 pt-1">
                              <span className="text-slate-400 font-bold flex items-center space-x-1 text-[9px]">
                                <AlertTriangle size={10} className="text-rose-500 shrink-0" />
                                <span>อาการขัดข้องตามส่งเรื่อง:</span>
                              </span>
                              <div className="bg-rose-50/70 p-2 rounded-lg border border-rose-100 text-rose-800 font-medium leading-relaxed break-words text-[9.5px]">
                                {rep.reportedProblem}
                              </div>
                            </div>
                          </div>

                          {/* Flex Footer */}
                          <div className="p-2 bg-slate-50 border-t border-slate-100 flex flex-col">
                            {rep.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => handleAcceptRepairFromLine(rep)}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-md font-bold text-[9px] transition-all hover:scale-[1.02] flex items-center justify-center space-x-1 shadow-xs"
                              >
                                <ShieldCheck size={11} />
                                <span>กดรับงานซ่อมทันที</span>
                              </button>
                            ) : (
                              <div className="w-full py-1.5 px-3 bg-slate-200 text-slate-500 rounded-md font-bold text-[9px] text-center">
                                ช่างรับงานเข้าระบบแล้ว ({rep.status === 'completed' ? 'ซ่อมเสร็จสิ้น' : 'กำลังดำเนินการซ่อม'})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isBot = msg.sender === 'bot';
                  return (
                    <div
                      key={index}
                      className={`max-w-[85%] rounded-2xl p-2.5 text-[9.5px] leading-relaxed animate-fade-in ${isBot ? 'bg-white text-slate-800 self-start rounded-tl-none border border-slate-150' : 'bg-[#62CD41] text-white self-end rounded-tr-none shadow-2xs font-medium'}`}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {msg.text}
                    </div>
                  );
                })}
              </div>

              {/* Chat Input Area mockup */}
              <div className="bg-white border-t border-slate-150 p-2 flex items-center space-x-1.5 shrink-0">
                <input
                  type="text"
                  placeholder="พิมพ์ข้อความคุยกับบอท..."
                  disabled
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-[9px] focus:outline-hidden"
                />
                <button disabled className="p-1 text-slate-300">
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
