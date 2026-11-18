import os
import sys
import math
import json
import time
import random
import shutil
import pathlib
import warnings
import logging
import traceback

import csv
import pickle
import zipfile

import numpy as np

import pandas as pd

import matplotlib.pyplot as plt
import matplotlib.image as mpimg

import seaborn as sns

from sklearn.linear_model import LinearRegression, LogisticRegression, SGDClassifier
from sklearn.cluster import KMeans
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, MinMaxScaler, PolynomialFeatures, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report, mean_squared_error, mean_absolute_error, r2_score, precision_score, recall_score, f1_score

import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import Dense, Conv2D, MaxPooling2D, Flatten, Dropout, BatchNormalization, LSTM, GRU, Embedding, SimpleRNN, Input
from tensorflow.keras.optimizers import SGD, Adam, Adagrad, RMSprop
from tensorflow.keras import regularizers
from tensorflow.keras.datasets import mnist, cifar10
from tensorflow.keras.preprocessing.image import ImageDataGenerator

import torch
import torch.nn as nn
import torch.optim as optim

import torchvision
import torchvision.transforms as transforms

from torch.utils.data import DataLoader

import cv2

from PIL import Image, ImageFilter, ImageEnhance
import PIL

import gymnasium as gym

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer

from transformers import pipeline, AutoTokenizer, AutoModel

import speech_recognition as sr
from pydub import AudioSegment

import wave
import librosa
import librosa.display
from matplotlib.animation import FuncAnimation
from statistics import mean, median
from scipy import stats
import requests
import threading
import multiprocessing

print("All Antigravity AI Libraries Imported Successfully")
