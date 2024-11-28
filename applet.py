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

# Sidebar
st.sidebar.title('Settings')
st.sidebar.markdown('Select a scripture to compare with others.')
book = st.sidebar.selectbox('Book', data['book_title'].unique())
# Filter dataframe based on selected country
f1_df = data[data["book_title"] == book]
chapter = st.sidebar.selectbox('Chapter', f1_df['chapter_number'].unique())
f2_df = f1_df[f1_df["chapter_number"] == chapter]
verse = st.sidebar.selectbox('Verse', f2_df['verse_number'].unique())
st.write(f'You selected {book} {chapter}:{verse}')

#get data subset based on selected verse
row = f2_df[(f2_df['verse_number'] == verse)].iloc[0]
# distance from selected verse based on tsne_x and tsne_y
data['distance'] = np.sqrt((data['tsne_x'] - row['tsne_x'])**2 + (data['tsne_y'] - row['tsne_y'])**2)
# get top 10 similar verses
top50 = data.sort_values('distance').head(50)
maxval = top50['distance'].max()
#set label based on distance
data['group'] = np.where(data['distance'] < maxval, 'Top50', ' ')

# Set highlight selection
highlight = alt.selection_multi(fields=['group'])

chart = alt.Chart(data).mark_point().encode(
    alt.X('tsne_x:Q', scale=alt.Scale(domain=[top50['tsne_x'].min(), top50['tsne_x'].max()]), axis=None),
    alt.Y('tsne_y:Q', scale=alt.Scale(domain=[top50['tsne_y'].min(), top50['tsne_y'].max()]), axis=None),
    color=alt.condition(highlight, 'group:N', alt.value('lightgray')),  # Highlight selected points
    tooltip=['verse_short_title','cluster']
).add_selection(highlight).interactive()










st.altair_chart(chart, use_container_width=True)

st.markdown('---')
for i in range(10):
    st.write(f'{top50['verse_short_title'].iloc[i]}: {top50['scripture_text'].iloc[i]}')
