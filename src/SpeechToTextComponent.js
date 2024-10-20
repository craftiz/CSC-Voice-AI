import React, { useState, useEffect, useRef } from 'react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Speech API Keys
const SPEECH_KEY = '9qBhM45nuEmfzTDDTyJFSl0j7e8f317z9z3BUxTrbhD1qL4H8dFMJQQJ99AJAC5RqLJXJ3w3AAAYACOGfJHi';
const SPEECH_REGION = 'westeurope';

// Translator API Keys
const TRANSLATOR_KEY = 'AAzgUJTaz9kanUktd6RBCeLugLFAwcV450bH2Ho2xsq4potwPzhaJQQJ99AJAC5RqLJXJ3w3AAAbACOG4sRG';  // Azure Translator key
const TRANSLATOR_REGION = 'westeurope';  // Azure Translator region

// Supported languages and their corresponding speech voice IDs
const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', voice: 'tr-TR-AhmetNeural' },
  { code: 'en', name: 'İngilizce', voice: 'en-US-JennyNeural' },
  { code: 'ru', name: 'Rusça', voice: 'ru-RU-DmitryNeural' },
  { code: 'de', name: 'Almanca', voice: 'de-DE-KatjaNeural' },
  { code: 'fr', name: 'Fransızca', voice: 'fr-FR-DeniseNeural' },
  { code: 'es', name: 'İspanyolca', voice: 'es-ES-ElviraNeural' },
  { code: 'it', name: 'İtalyanca', voice: 'it-IT-DiegoNeural' },
  // Daha fazla dil ekleyebilirsiniz...
];

export function SpeechToTextComponent() {
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('tr'); // Default to Turkish
  const [selectedSynthesisLanguage, setSelectedSynthesisLanguage] = useState('en'); // Varsayılan seslendirme dili
  const speechConfig = useRef(null);
  const audioConfig = useRef(null);
  const recognizer = useRef(null);
  const synthesizer = useRef(null); // Synthesis için kullanılacak

  const [myTranscript, setMyTranscript] = useState("");
  const [recognizingTranscript, setRecTranscript] = useState("");
  const [translatedTexts, setTranslatedTexts] = useState({}); // Çeviri metinleri için nesne

  useEffect(() => {
    // Konuşma tanıma yapılandırmasını başlat
    speechConfig.current = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
    speechConfig.current.speechRecognitionLanguage = selectedLanguage === 'tr' ? 'tr-TR' : 'en-US'; // Türkçe veya İngilizce

    audioConfig.current = sdk.AudioConfig.fromDefaultMicrophoneInput();
    recognizer.current = new sdk.SpeechRecognizer(speechConfig.current, audioConfig.current);

    // Ses sentezleyici için yapılandırma
    synthesizer.current = new sdk.SpeechSynthesizer(speechConfig.current, sdk.AudioConfig.fromDefaultSpeakerOutput());

    const processTranscript = async (event) => {
      const result = event.result;
      if (result.reason === sdk.ResultReason.RecognizedSpeech) {
        const transcript = result.text;
        setMyTranscript(transcript);

        // Metni çevir
        const translations = {};
        for (const lang of SUPPORTED_LANGUAGES) {
          if (lang.code !== selectedLanguage) {
            translations[lang.code] = await translateText(transcript, selectedLanguage, lang.code);
          }
        }
        setTranslatedTexts(translations);

        // Tanıma tamamlandığında seçilen dilde çeviri ve seslendirme başlat
        const selectedTranslation = translations[selectedSynthesisLanguage];
        if (selectedTranslation) {
          speakText(selectedTranslation);  // Çevrilen metni seslendir
        }
      }
    };

    const processRecognizingTranscript = (event) => {
      const result = event.result;
      if (result.reason === sdk.ResultReason.RecognizingSpeech) {
        const transcript = result.text;
        setRecTranscript(transcript);
      }
    };

    recognizer.current.recognized = (s, e) => processTranscript(e);
    recognizer.current.recognizing = (s, e) => processRecognizingTranscript(e);

    return () => {
      if (recognizer.current) {
        recognizer.current.stopContinuousRecognitionAsync();
      }
    };
  }, [selectedLanguage, selectedSynthesisLanguage]); // selectedLanguage veya selectedSynthesisLanguage değiştiğinde etkiyi yeniden çalıştır

  // Translator API için metin çevirme fonksiyonu
  const translateText = async (text, fromLang, toLang) => {
    try {
      const response = await fetch(
        `https://${TRANSLATOR_REGION}.api.cognitive.microsoft.com/translator/text/v3.0/translate?api-version=3.0&from=${fromLang}&to=${toLang}`, 
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Region': TRANSLATOR_REGION,
          },
          body: JSON.stringify([{ Text: text }]),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data[0]?.translations[0]?.text || 'Translation failed';
    } catch (error) {
      console.error('Error during translation:', error);
      return 'Translation failed';
    }
  };

  // Text-to-Speech fonksiyonu
  const speakText = (text) => {
    if (synthesizer.current) {
      const selectedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedSynthesisLanguage);
      const voiceName = selectedLanguage ? selectedLanguage.voice : 'en-US-JennyNeural'; // Default voice

      // speechConfig.current.speechSynthesisVoiceName özelliğini ayarlıyoruz
      speechConfig.current.speechSynthesisVoiceName = voiceName;

      // Çeviri tamamlandığında seçilen dilde otomatik seslendirme
      synthesizer.current.speakTextAsync(text, (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log("Speech synthesis succeeded.");
        } else {
          console.error("Speech synthesis failed:", result.errorDetails);
        }
      });
    }
  };

  const startListening = () => {
    if (recognizer.current) {
      recognizer.current.startContinuousRecognitionAsync(() => {
        setIsListening(true);
      });
    }
  };

  const stopListening = () => {
    if (recognizer.current) {
      recognizer.current.stopContinuousRecognitionAsync(() => {
        setIsListening(false);
      });
    }
  };

  return (
    <div>
      <h1>Konuşma Tanıma ve Çeviri</h1>
      <div>
        <label>Dili Seçin: </label>
        <select onChange={(e) => setSelectedLanguage(e.target.value)} value={selectedLanguage}>
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Seslendirme Dili Seçin: </label>
        <select onChange={(e) => setSelectedSynthesisLanguage(e.target.value)} value={selectedSynthesisLanguage}>
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>
      <button onClick={startListening}>Dinlemeye Başla</button>
      <button onClick={stopListening}>Dinlemeyi Durdur</button>

      <div>
        <h2>Sonuçlar</h2>
        <div>
          <strong>Tanınan Metin:</strong> {recognizingTranscript}
        </div>

        <div>
          <strong>Tanınmış Metin:</strong> {myTranscript}
        </div>

        <div>
          <strong>Çeviriler:</strong>
          {SUPPORTED_LANGUAGES.map(lang => (
            lang.code !== selectedLanguage && (
              <div key={lang.code}>
                <strong>{lang.name}:</strong> {translatedTexts[lang.code] || 'Çeviri bekleniyor...'}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
