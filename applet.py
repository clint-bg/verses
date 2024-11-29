import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

st.title('verses')
st.markdown('Pick a scripture verse and see that other scriptures are similar to it.')

# Load data
@st.cache_data
def load_data():
    return pd.read_csv('data/scriptures_sub.csv')

data = load_data()
#shift all the values of tsne_x and tsne_y to positive values
data['tsne_x'] = data['tsne_x'] - data['tsne_x'].min()
data['tsne_y'] = data['tsne_y'] - data['tsne_y'].min()

# Sidebar
st.sidebar.title('verse')
st.sidebar.markdown('Select a scripture to compare with others.')

def moveUp():
    top = st.session_state.top50
    val = top['tsne_y'].max()
    set(top[top['tsne_y'] == val])

def moveDown():
    top = st.session_state.top50
    val = top['tsne_y'].min()
    set(top[top['tsne_y'] == val])

def moveRight():
    top = st.session_state.top50
    val = top['tsne_x'].max()
    set(top[top['tsne_x'] == val])

def moveLeft():
    top = st.session_state.top50
    val = top['tsne_x'].min()
    set(top[top['tsne_x'] == val])

def setref(i):
    row = st.session_state.top50.iloc[i]
    return set(row)

def set(row):
    try:
        st.session_state.book = row['book_title'].iloc[0]
        st.session_state.chapter = row['chapter_number'].iloc[0]
        st.session_state.verse = row['verse_number'].iloc[0]
    except:
        st.session_state.book = row['book_title']
        st.session_state.chapter = row['chapter_number']
        st.session_state.verse = row['verse_number']

book = st.sidebar.selectbox('Book', data['book_title'].unique(), key='book', index=42)
# Filter dataframe based on selected country
f1_df = data[data["book_title"] == book]
chapter = st.sidebar.selectbox('Chapter', f1_df['chapter_number'].unique(),key='chapter', index=2)
f2_df = f1_df[f1_df["chapter_number"] == chapter]
try:
    verse = st.sidebar.selectbox('Verse', f2_df['verse_number'].unique(),key='verse', index=15)
except:
    st.session_state.verse = f2_df['verse_number'].iloc[0]
st.write(f'You selected {book} {chapter}:{verse}')

#get data subset based on selected verse
row = f2_df[(f2_df['verse_number'] == verse)].iloc[0]
# distance from selected verse based on tsne_x and tsne_y
data['distance'] = np.sqrt((data['tsne_x'] - row['tsne_x'])**2 + (data['tsne_y'] - row['tsne_y'])**2)
# get top similar verses
top50 = data.sort_values('distance').head(50)
maxval = top50['distance'].max()
#Get subset of data that is not in the top 50
data_50 = data[~data['verse_short_title'].isin(top50['verse_short_title'])]
top50['group'] = 'Closest 50'
data_50['group'] = 'The Rest'

st.session_state['top50'] = top50

#get a random subsample of the scriptures that includes the top 50 to speed up rendering
data_rand = data_50.sample(5000, random_state=1)
data_plot = pd.concat([data_rand, top50])


# Set highlight selection
highlight = alt.selection_multi(fields=['group'])

chart = alt.Chart(data_plot).mark_point().encode(
    alt.X('tsne_x', scale=alt.Scale(domain=[top50['tsne_x'].min()*0.8, top50['tsne_x'].max()*1.2]), axis=None),
    alt.Y('tsne_y', scale=alt.Scale(domain=[top50['tsne_y'].min()*0.8, top50['tsne_y'].max()*1.2]), axis=None),
    color=alt.condition(highlight, 'group', alt.value('lightgray')),  # Highlight selected points
    tooltip=['verse_short_title','cluster']
).add_selection(highlight).interactive()


st.markdown('---')

st.altair_chart(chart, use_container_width=True)

st.markdown('---')

col1, col2, col3, col4 = st.columns(4)

col1.button('Move Up', key='move_up', on_click=moveUp)
col2.button('Move Down', key='move_down', on_click=moveDown)
col3.button('Move Right', key='move_right', on_click=moveRight)
col4.button('Move Left', key='move_left', on_click=moveLeft)

st.markdown('---')

textval = top50['verse_short_title'].iloc[0]
st.button(textval)
st.write(f'{top50['scripture_text'].iloc[0]}')

textval = top50['verse_short_title'].iloc[1]
st.button(textval, on_click=lambda: setref(1))
st.write(f'{top50['scripture_text'].iloc[1]}')

textval = top50['verse_short_title'].iloc[2]
st.button(textval, on_click=lambda: setref(2))
st.write(f'{top50['scripture_text'].iloc[2]}')

textval = top50['verse_short_title'].iloc[3]
st.button(textval, on_click=lambda: setref(3))
st.write(f'{top50['scripture_text'].iloc[3]}')

textval = top50['verse_short_title'].iloc[4]
st.button(textval, on_click=lambda: setref(4))
st.write(f'{top50['scripture_text'].iloc[4]}')

textval = top50['verse_short_title'].iloc[5]
st.button(textval, on_click=lambda: setref(5))
st.write(f'{top50['scripture_text'].iloc[5]}')

textval = top50['verse_short_title'].iloc[6]
st.button(textval, on_click=lambda: setref(6))
st.write(f'{top50['scripture_text'].iloc[6]}')

textval = top50['verse_short_title'].iloc[7]
st.button(textval, on_click=lambda: setref(7))
st.write(f'{top50['scripture_text'].iloc[7]}')

textval = top50['verse_short_title'].iloc[8]
st.button(textval, on_click=lambda: setref(8))
st.write(f'{top50['scripture_text'].iloc[8]}')

st.markdown('---')

otherscrip = 'Other Similar Scriptures: '
for i in range(9, 50):
    otherscrip += ', ' + top50['verse_short_title'].iloc[i]
st.write(otherscrip)

st.markdown('---')
st.markdown('## about')
st.write('This app was developed using Google generativeai package. First each scripture of over 41,000 verses was processed with text-embedding-004 and then embedded into a 2D space using t-SNE. The above map is where each scripture is given a 2D coordinate. Further details can be found on [kaggle](https://www.kaggle.com/code/molecman/classification-of-book-of-mormon-authors).')
