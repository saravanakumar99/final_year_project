import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ChatHistory from './ChatHistory';
import Loading from './Loading';
import './ChatBotSection.css'

const ChatSection = ({ onClose }) => {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const genAI = new GoogleGenerativeAI(
    'AIzaSyCL8ttNVAkjxQz7NBaK4VLg66-DjvAwW08'
  );
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const handleUserInput = (e) => {
    setUserInput(e.target.value);
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;

    setIsLoading(true);
    try {
      const result = await model.generateContent(userInput);
      const response = await result.response;
      setChatHistory([
        ...chatHistory,
        { type: 'user', message: userInput },
        { type: 'bot', message: response.text() },
      ]);
    } catch (error) {
      console.error('Error fetching response from Gemini:', error);
    } finally {
      setUserInput('');
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  return (
    <div className="floating-chat-window">
      <div className="chat-header">
        <span>AI Assistant</span>
        <button onClick={onClose} className="close-button">
          ×
        </button>
      </div>
      <div className="chat-container">
        <ChatHistory chatHistory={chatHistory} />
        <Loading isLoading={isLoading} />
      </div>
      <div className="chat-input-section">
        <input
          type="text"
          value={userInput}
          onChange={handleUserInput}
          placeholder="Type your message..."
          className="chat-input"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading}
          className="send-button"
        >
          Send
        </button>
        <button onClick={clearChat} className="clear-button">
          Clear
        </button>
      </div>
    </div>
  );
};

export default ChatSection;
